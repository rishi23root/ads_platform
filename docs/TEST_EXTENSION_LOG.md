# Extension Ad Block Test Script

This script simulates browser extension requests by fetching ad block data (ads and notifications) and automatically logging visits using **real data from your database**.

## Quick Start

Create an extension user at **`/register`** (or via API), then:

```bash
cd /path/to/admin_dashboard
EXTENSION_EMAIL='you@example.com' EXTENSION_PASSWORD='yourpassword' ./docs/test-extension-log.sh
```

## What It Does

1. **Logs in** with `POST /api/extension/auth/login` (extension user — not admin)
2. **Gets a target domain** from public `GET /api/extension/domains` (first domain, or fallback `example.com`)
3. **Calls** `POST /api/extension/ad-block` with **`Authorization: Bearer`** and JSON `{ domain, requestType? }`

Telemetry is written to **`enduser_events`** for that user.

## Features

- Uses real **Bearer** session flow (matches production extension behavior)
- No admin cookie required (avoids protected `/api/platforms`)

## Usage Examples

### Required: extension user credentials

```bash
EXTENSION_EMAIL='you@example.com' EXTENSION_PASSWORD='secret' ./docs/test-extension-log.sh
```

### Different server URL

```bash
BASE_URL=http://localhost:4000 EXTENSION_EMAIL='you@example.com' EXTENSION_PASSWORD='secret' ./docs/test-extension-log.sh
```

## Output

The script will:

- Log in and acquire a session token
- Print the domain used (from `GET /api/extension/domains` or `example.com`)
- Call ad-block three times (combined, ads-only, notifications-only) and print HTTP status plus ad/notification counts
- Print a sample `curl` snippet you can paste (with your email; password shown as `…`)

## Example Output

```
==========================================
Extension Ad Block Test Script
==========================================
Base URL: http://localhost:3000

Logging in as extension user...
Login OK (token acquired).

Fetching target domains (public API)...
Using domain from API: instagram.com

==========================================
Testing ad-block endpoint (Bearer auth)...
==========================================

Testing: Get both ads and notifications (default)
  Domain: instagram.com
  ✓ Success
  Found: 1 ad(s), 0 notification(s)

Testing: Get ads only
  Domain: instagram.com
  ✓ Success
  Found: 1 ad(s), 0 notification(s)

Testing: Get notifications only
  Domain: instagram.com
  ✓ Success
  Found: 0 ad(s), 0 notification(s)

==========================================
Done!
==========================================
```

## Manual Curl Commands

If you prefer to use curl directly:

### Public domains list (no admin session)

```bash
curl -s http://localhost:3000/api/extension/domains
```

### Get Ads for a Domain (admin dashboard API; requires admin cookie/session)

```bash
curl "http://localhost:3000/api/ads?domain=https://www.instagram.com/"
```

### Login (get token)

```bash
curl -s -X POST http://localhost:3000/api/extension/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'
```

### Get Ad Block Data (Both Ads and Notifications)

```bash
TOKEN='<paste token from login response>'

curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"domain":"instagram.com"}'
```

### Get Ads Only

```bash
curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"domain":"instagram.com","requestType":"ad"}'
```

### Get Notifications Only

```bash
curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"requestType":"notification"}'
```

**Note:** Do not send `endUserId` in the body; the user is identified by the Bearer token.

## Requirements

- `curl` — API requests
- `jq` — **required** by `test-extension-log.sh` (login + domain parsing)

## Viewing Results

After running the script, check your dashboard:

- **Analytics Dashboard**: `http://localhost:3000/analytics`
  - Shows all request logs
  - Displays user statistics
  - Shows ad and notification request counts

- **Ads API**: `http://localhost:3000/api/ads?domain=<your-domain>`
  - Returns active ads for a specific domain

## Notes

- **`pnpm db:truncate:enduser-events`** truncates only `enduser_events`; **`pnpm redis:reset-live-count`** clears the dashboard live connection counter in Redis when it gets stuck.
- The script uses the same hostname shape as `/api/extension/domains` (or a fallback), which matches what a real extension sends on ad-block
- The authenticated user is always the **`end_users`** row tied to your extension login; telemetry rows use that client’s id in **`enduser_events`**
- Logs appear in Analytics shortly after each successful ad-block call
