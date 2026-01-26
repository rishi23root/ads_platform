# Extension Log Test Script

This script simulates browser extension pull requests by creating log entries in your dashboard using **real data from your database**.

## Quick Start

```bash
./test-extension-log.sh
```

## What It Does

1. **Fetches real platforms** from your database via `/api/platforms`
2. **Finds active ads** for those platforms via `/api/ads`
3. **Creates log entries** for both 'ad' and 'notification' request types
4. **Uses actual domain names** from your configured platforms

## Features

- ✅ Automatically uses real platforms and domains from your database
- ✅ Shows which ads are active for each platform
- ✅ Creates realistic test logs that appear in your Analytics dashboard
- ✅ Generates unique visitor IDs (timestamp-based)
- ✅ Supports custom visitor IDs via environment variable

## Usage Examples

### Basic Usage
```bash
./test-extension-log.sh
```

### Custom Visitor ID
```bash
VISITOR_ID=my-custom-user-123 ./test-extension-log.sh
```

### Different Server URL
```bash
BASE_URL=http://localhost:4000 ./test-extension-log.sh
```

## Output

The script will:
- Display found platforms and their domains
- Show active ads for each platform
- Create log entries and display success/failure
- Provide links to view logs in the Analytics dashboard

## Example Output

```
==========================================
Extension Log Test Script
==========================================
Base URL: http://localhost:3000

Fetching platforms from database...
Found platform: insta
Using domain: instagram.com (extracted from: https://www.instagram.com/)

Fetching ads from database...
Found 1 active ad(s) for this platform:
  - testing (Status: active)

==========================================
Generating test logs...
==========================================

Logging ad request...
  Domain: instagram.com
  Visitor ID: test-visitor-1769459034
  ✓ Success! Log created for ad

Logging notification request...
  Domain: instagram.com
  Visitor ID: test-visitor-1769459034
  ✓ Success! Log created for notification

==========================================
Done!
==========================================

Check your Analytics dashboard at:
  http://localhost:3000/analytics
```

## Manual Curl Commands

If you prefer to use curl directly, here are the commands using your actual data:

### Get Platforms
```bash
curl http://localhost:3000/api/platforms
```

### Get Ads for a Domain
```bash
# Use the exact domain format from your database
curl "http://localhost:3000/api/ads?domain=https://www.instagram.com/"
```

### Log Ad Request
```bash
curl -X POST http://localhost:3000/api/extension/log \
  -H "Content-Type: application/json" \
  -d '{
    "visitorId": "test-visitor-123",
    "domain": "instagram.com",
    "requestType": "ad"
  }'
```

### Log Notification Request
```bash
curl -X POST http://localhost:3000/api/extension/log \
  -H "Content-Type: application/json" \
  -d '{
    "visitorId": "test-visitor-123",
    "domain": "instagram.com",
    "requestType": "notification"
  }'
```

## Requirements

- `curl` - for API requests
- `jq` (optional) - for better JSON formatting. Install with:
  - Ubuntu/Debian: `sudo apt-get install jq`
  - macOS: `brew install jq`

## Viewing Results

After running the script, check your dashboard:

- **Analytics Dashboard**: `http://localhost:3000/analytics`
  - Shows all request logs
  - Displays user statistics
  - Shows ad and notification request counts

- **Ads API**: `http://localhost:3000/api/ads?domain=<your-domain>`
  - Returns active ads for a specific domain

## Notes

- The script uses the clean domain format (e.g., `instagram.com`) for logging, which is what a real extension would send
- When checking for ads, it uses the stored domain format from your database
- Each run generates a new visitor ID unless you specify one
- Logs appear immediately in the Analytics dashboard
