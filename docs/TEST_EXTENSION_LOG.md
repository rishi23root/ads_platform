# Extension Test Script

This script simulates extension requests using real database data. It tests the v2 API: SSE init, `POST /api/extension/serve`, and batched events.

## Quick Start

Create an extension user at `/register` (or via API), then:

```bash
cd /path/to/admin_dashboard
EXTENSION_EMAIL='you@example.com' EXTENSION_PASSWORD='yourpassword' ./docs/test-extension-log.sh
```

## What It Does

1. **Logs in** with `POST /api/extension/auth/login` (extension user — not admin)
2. Uses `example.com` as test domain (in production the extension reads `init.domains` from the SSE stream)
3. Calls `POST /api/extension/serve` to test creative serving

Telemetry written to `enduser_events` for that user.

## Manual Curl Commands

### Login (get token)

```bash
curl -s -X POST http://localhost:3000/api/extension/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'
```

### Open SSE stream (first event is `init`)

The `init` event carries `user`, `domains` (campaign-referenced hostnames), and `redirects` (rewrite rules + caps). Ads and notifications are **not** in `init`.

```bash
TOKEN='<paste token>'
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/extension/live?token=$TOKEN"
```

### Serve creatives for a domain (inline ads, popups, notifications)

```bash
TOKEN='<paste token>'
curl -X POST http://localhost:3000/api/extension/serve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"domain":"instagram.com"}'
```

Optional: `"type":"ads"`, `"popup"`, or `"notification"` to return only that campaign kind.

### Redirect rules

Redirects are **not** available on `POST /api/extension/serve`. Use **`GET /api/extension/live?token=…`** (SSE): the first event is `init` with `redirects`; later, `redirects_updated` repeats the full list.

### Batch-report events

Flush when ≥10 events or ~60 s since oldest queued item.

```bash
curl -X POST http://localhost:3000/api/extension/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "events": [
      { "type": "visit", "domain": "instagram.com" },
      { "type": "redirect", "campaignId": "<uuid>", "domain": "instagram.com" },
      { "type": "notification", "campaignId": "<uuid>", "domain": "instagram.com" }
    ]
  }'
```

> Note: `GET /api/extension/domains` has been **removed**. Extensions must use `init.domains` from the SSE stream and refresh on the `platforms_updated` event.

## Requirements

- `curl` — API requests
- `jq` — login parsing in `test-extension-log.sh`

## Viewing Results

After running, check the dashboard:

- **Analytics**: `http://localhost:3000/analytics` — event counts, user stats
- **Events table** (`enduser_events`) — one row per `visit`, `redirect`, `notification`, `ad`, or `popup`

## Notes

- **`pnpm db:truncate:enduser-events`** truncates only `enduser_events`.
- **`pnpm redis:reset-live-count`** clears extension live SSE leases in Redis (`realtime:connections:leases`) and resets the published dashboard count.
- The authenticated user is always the `end_users` row tied to your extension login; rows use that client's identifier in `enduser_events`.
