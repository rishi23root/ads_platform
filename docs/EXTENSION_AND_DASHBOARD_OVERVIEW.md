# Extension & Admin Dashboard: How It All Works

This document explains how the **browser extension** and **admin dashboard** work together, how they communicate, how notifications and ads flow, and how you can **reduce request volume** to the backend.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Who Does What](#2-who-does-what)
3. [Communication Between Extension and Backend](#3-communication-between-extension-and-backend)
4. [How Notifications (and Ads) Work End-to-End](#4-how-notifications-and-ads-work-end-to-end)
5. [Why You Can Get Many Requests Per Second](#5-why-you-can-get-many-requests-per-second)
6. [Improving Data Delivery: Fewer Requests, Same Data](#6-improving-data-delivery-fewer-requests-same-data)
7. [Quick Reference](#7-quick-reference)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD (Next.js)                          │
│  • Admins create/manage: Platforms, Ads, Notifications                       │
│  • Admins view: Analytics (request logs from extension)                      │
│  • Serves public API used by the extension                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                    ▲                                    │
                    │                                    │
         Extension calls                        Dashboard calls
         (no auth)                               (auth required)
                    │                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER EXTENSION (your code)                         │
│  • Runs on user’s browser on configured domains                              │
│  • Fetches ads + notifications from dashboard API                           │
│  • Replaces ads / shows notifications on the page                           │
│  • Sends logs back for analytics                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Admin Dashboard**: backend + UI. It stores platforms, ads, notifications, and request logs. It exposes **public** endpoints for the extension and **protected** endpoints for the admin UI.
- **Extension**: runs in the user’s browser, calls the dashboard’s **public** API to get ads/notifications and to send logs. There is **no direct connection** from dashboard to extension (no push); the extension always **pulls** from the dashboard.

---

## 2. Who Does What

| Component            | Responsibility |
|----------------------|----------------|
| **Admin Dashboard**  | Store platforms (domains), ads, notifications; serve them by domain; accept and store extension request logs; show analytics (charts, etc.). |
| **Browser Extension**| On each configured domain: fetch ads and notifications, replace ads / show notifications, send one or more log entries to `/api/extension/log` (e.g. one per “ad” and one per “notification” when both are used). |
| **Database**         | `platforms`, `ads`, `notifications`, `notification_platforms`, `extension_users`, `request_logs`. |
| **Redis**           | Used for admin session (login). Not used for extension traffic. |

There is **no real-time push** (e.g. WebSockets) from dashboard to extension. All “notification” content is just **data** the extension fetches via the same API; “notification” in the API means “notification-type content,” not a push notification.

---

## 3. Communication Between Extension and Backend

All communication is **HTTP (REST)**. The extension is the only client of these **public** endpoints (no auth).

### 3.1 Extension → Dashboard (what the extension calls)

| Purpose              | Method | Endpoint                          | When extension typically calls |
|----------------------|--------|-----------------------------------|---------------------------------|
| Get ads for domain   | GET    | `/api/ads?domain={domain}`        | When it needs to show ads (e.g. on page load / domain match). |
| Get notifications    | GET    | `/api/notifications?domain={domain}` | When it needs to show notifications for that domain. |
| Send analytics       | POST   | `/api/extension/log`              | After an ad or notification is used (one POST per event type in current design). |

- **Ads**: extension sends `domain`; dashboard returns active ads for the platform that matches that domain.
- **Notifications**: same idea: `domain` → platform → notifications linked to that platform and within their date range.
- **Log**: body is `{ visitorId, domain, requestType }` with `requestType` either `"ad"` or `"notification"`. Each successful POST creates one row in `request_logs` and updates (or creates) `extension_users` (e.g. `lastSeenAt`, `totalRequests`).

### 3.2 Dashboard → Extension

There is **no** direct dashboard → extension call. The dashboard only:

- Serves the above API when the extension calls it.
- Uses stored data (including `request_logs`) to show analytics in the admin UI.

So “notification” in the product sense is: **extension pulls notification content from the API and displays it**; it is not a push from server to browser.

### 3.3 Data flow summary

```
Extension (user on example.com)
    │
    ├─ GET /api/ads?domain=example.com
    │       → Dashboard queries DB (platform by domain → active ads)
    │       → Returns JSON array of ads
    │
    ├─ GET /api/notifications?domain=example.com
    │       → Dashboard queries DB (platform → notifications in date range)
    │       → Returns JSON array of notifications
    │
    └─ POST /api/extension/log (once or twice per “page use”)
            Body: { visitorId, domain, requestType: "ad" } and/or { ..., requestType: "notification" }
            → Dashboard: insert into request_logs, upsert extension_users
            → Returns 201 + log object
```

Details of the log API (validation, errors, one JSON object per request) are in [EXTENSION_LOG_API.md](./EXTENSION_LOG_API.md).

---

## 4. How Notifications (and Ads) Work End-to-End

### 4.1 Configuration (in the dashboard)

1. **Platforms**: each platform has a **domain** (e.g. `example.com`). Ads and notifications are tied to platforms.
2. **Ads**: linked to one platform; have status (e.g. `active`) and optional start/end dates. Dashboard auto-expires ads when `endDate` has passed.
3. **Notifications**: have `startDate` and `endDate` and are linked to **one or more platforms** via `notification_platforms`. So one notification can show on many domains.

### 4.2 Extension flow (what the extension does)

1. User visits a page; extension gets domain (e.g. from `window.location.hostname`).
2. **Fetch ads**: `GET /api/ads?domain=example.com` → list of active ads for that domain.
3. **Fetch notifications**: `GET /api/notifications?domain=example.com` → list of notifications currently in range for that domain.
4. Extension renders ads (e.g. replace existing ad slots) and shows notifications (e.g. banner or popup).
5. **Log usage**: `POST /api/extension/log` with `requestType: "ad"` and/or `requestType: "notification"` (current design often uses one POST per type).

So “how notification works” is: **dashboard stores notification content and date range; extension asks “what notifications are active for this domain?” and then displays them and logs that it did so.**

---

## 5. Why You Can Get Many Requests Per Second

Request volume scales with **number of extension users × how often each one triggers requests**.

Typical causes of high request rate:

1. **Per-event logging**  
   If the extension sends one `POST /api/extension/log` per ad view and per notification view, then:
   - One page load with 3 ad slots + 1 notification → 4 log requests.
   - Many tabs or many navigations → multiplies that.

2. **No (or short) caching**  
   If the extension calls `GET /api/ads` and `GET /api/notifications` on every page load or every tab switch without caching, request count grows with page loads and tabs.

3. **Many users / many domains**  
   Same logic per user; more users and more domains mean more total requests.

4. **No batching**  
   Each log event is one HTTP request. With batching, N events can become 1 request.

So “many requests each second” usually means: **lots of small, frequent calls from the extension to the dashboard**, especially to `/api/extension/log` and/or to the ads and notifications GET endpoints.

---

## 6. Improving Data Delivery: Fewer Requests, Same Data

You can reduce requests **without losing data** by changing both the **extension** and, where needed, the **backend**.

### 6.1 Extension-side: cache ads and notifications

- **Idea**: Cache the responses of `GET /api/ads?domain=...` and `GET /api/notifications?domain=...` in memory or extension storage (e.g. by `domain`).
- **TTL**: e.g. 5–15 minutes. After TTL, next time the extension needs data for that domain, it refetches.
- **Effect**: Same domain in many tabs or quick refreshes = 1 pair of GETs per TTL instead of per load. Fewer GET requests per second.

Optional: invalidate or shorten TTL when the user explicitly refreshes or when the extension updates.

### 6.2 Extension-side: batch log events (recommended)

- **Idea**: Do **not** send one `POST /api/extension/log` per event. Instead, **buffer** events in the extension and send them in a **batch** every N seconds or when the buffer reaches M items.
- **Example**: Buffer `{ visitorId, domain, requestType }[]` and every 30 seconds (or when 10 items are queued) send one `POST` with a JSON array.
- **Backend change required**: The dashboard must support a **batch log** endpoint that accepts an array and:
  - Inserts multiple rows into `request_logs`,
  - Updates `extension_users` once per `visitorId` (e.g. increment `totalRequests` by count, set `lastSeenAt` to latest).
- **Effect**: Large reduction in number of log requests; same analytics data (or even better, with exact timestamps per event if you store them).

### 6.3 Backend: add a batch log endpoint

- **New endpoint**: e.g. `POST /api/extension/log/batch`.
- **Body**:  
  `{ "events": [ { "visitorId", "domain", "requestType" }, ... ] }`  
  Optional: add a client-generated `timestamp` per event if you want to preserve exact time when the event happened (otherwise server time is fine).
- **Server logic**:
  - Validate all items (same rules as single log).
  - Single DB transaction: bulk insert into `request_logs`; for each distinct `visitorId`, upsert `extension_users` (e.g. set `lastSeenAt` to max of existing and new, set `totalRequests = totalRequests + count` for that visitor).
- **Extension**: Use only the batch endpoint; stop calling the single-event `POST /api/extension/log` for each action.

This is the single biggest lever to reduce **log** requests per second.

### 6.4 Backend: optional combined “content” endpoint

- **Idea**: One call for the extension to get both ads and notifications for a domain.
- **New endpoint**: e.g. `GET /api/extension/content?domain=example.com` returning something like:
  `{ "ads": [...], "notifications": [...] }`
- **Implementation**: Run the same logic as current `GET /api/ads` and `GET /api/notifications` for that domain and return both in one response.
- **Effect**: Cuts the number of GET requests per “load” in half (one request instead of two). Combined with caching, this further reduces GET traffic.

### 6.5 Throttling / debouncing in the extension

- **Logging**: If you don’t batch, at least **throttle** (e.g. at most one log request per user per 5–10 seconds per domain or globally).
- **Fetching**: Don’t refetch ads/notifications on every tiny navigation; debounce or only refetch when domain actually changes or cache expires.

### 6.6 Summary of impact

| Change                          | Where        | Effect |
|---------------------------------|-------------|--------|
| Cache ads/notifications by domain (e.g. 5–15 min TTL) | Extension   | Fewer GET requests per second. |
| Batch log events + batch API    | Extension + backend | Far fewer POST requests; same or better data. |
| Combined GET content endpoint  | Backend (optional) | Fewer GET requests per load. |
| Throttle/debounce log and fetch | Extension   | Fewer requests during bursts. |

Implementing **batching for logs** (extension buffer + batch endpoint) and **caching for ads/notifications** will usually give the largest gain with a clear path.

---

## 7. Quick Reference

### Extension → Dashboard APIs (public)

| Endpoint                         | Method | Purpose |
|----------------------------------|--------|--------|
| `/api/ads?domain={domain}`       | GET    | Active ads for domain. |
| `/api/notifications?domain={domain}` | GET | Active notifications for domain (by date range). |
| `/api/extension/log`             | POST   | Single log event: `{ visitorId, domain, requestType }`. |

### How “notifications” work

- **Backend**: Stores notification title, message, dates, and platform (domain) links. No push.
- **Extension**: Pulls notifications with `GET /api/notifications?domain=...` and displays them; then logs with `requestType: "notification"`.

### Reducing requests (short list)

1. **Extension**: Cache ads and notifications by domain (TTL 5–15 min).
2. **Extension**: Buffer log events; send in batches (e.g. every 30 s or 10 events).
3. **Backend**: Add `POST /api/extension/log/batch` and process arrays; update extension to use it.
4. **Optional**: Add `GET /api/extension/content?domain=...` returning both ads and notifications.
5. **Extension**: Throttle/debounce any remaining per-event calls.

For full API details see [EXTENSION_LOG_API.md](./EXTENSION_LOG_API.md) and [EXTENSION_API_DOCS.md](../EXTENSION_API_DOCS.md). For system architecture see [ARCHITECTURE.md](./ARCHITECTURE.md).
