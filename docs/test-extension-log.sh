#!/bin/bash

# Simulate extension ad-block calls using a real extension user session.
# Requires: EXTENSION_EMAIL, EXTENSION_PASSWORD (same account you'd use in the extension).
# Uses public GET /api/extension/domains for a hostname (not admin /api/platforms).
#
# Target host: BASE_URL if set, else BETTER_AUTH_BASE_URL or BETTER_AUTH_URL (same as app auth).

if [ -z "${BASE_URL:-}" ]; then
  BASE_URL="${BETTER_AUTH_BASE_URL:-${BETTER_AUTH_URL:-}}"
fi
if [ -z "$BASE_URL" ]; then
  echo "Error: Set BASE_URL or BETTER_AUTH_BASE_URL or BETTER_AUTH_URL (e.g. export from .env.local)"
  exit 1
fi

echo "=========================================="
echo "Extension Ad Block Test Script"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

if [ -z "$EXTENSION_EMAIL" ] || [ -z "$EXTENSION_PASSWORD" ]; then
  echo "Error: Set EXTENSION_EMAIL and EXTENSION_PASSWORD for an extension user"
  echo "  (create one at $BASE_URL/register or via POST /api/extension/auth/register)"
  echo ""
  echo "Example:"
  echo "  EXTENSION_EMAIL=user@example.com EXTENSION_PASSWORD='yourpassword' $0"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required (for login + domain JSON)."
  echo "  Ubuntu/Debian: sudo apt-get install jq"
  echo "  macOS: brew install jq"
  exit 1
fi

echo "Logging in as extension user..."
LOGIN_RES=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/extension/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EXTENSION_EMAIL\",\"password\":\"$EXTENSION_PASSWORD\"}")

HTTP_CODE=$(echo "$LOGIN_RES" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
LOGIN_BODY=$(echo "$LOGIN_RES" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "Login failed (HTTP $HTTP_CODE): $LOGIN_BODY"
  exit 1
fi

TOKEN=$(echo "$LOGIN_BODY" | jq -r .token)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login response had no token: $LOGIN_BODY"
  exit 1
fi

echo "Login OK (token acquired)."
echo ""

echo "Fetching target domains (public API)..."
DOMAINS_JSON=$(curl -s "$BASE_URL/api/extension/domains")
DOMAIN=$(echo "$DOMAINS_JSON" | jq -r '.domains[0] // empty')

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "null" ]; then
  echo "Warning: No domains from /api/extension/domains — using example.com"
  DOMAIN="example.com"
else
  echo "Using domain from API: $DOMAIN"
fi

echo ""
echo "=========================================="
echo "Testing ad-block endpoint (Bearer auth)..."
echo "=========================================="
echo ""

test_ad_block() {
  local request_type=$1
  local description=$2

  echo "Testing: $description"
  echo "  Domain: $DOMAIN"

  if [ -n "$request_type" ]; then
    body_json="{\"domain\": \"$DOMAIN\", \"requestType\": \"$request_type\"}"
  else
    body_json="{\"domain\": \"$DOMAIN\"}"
  fi

  response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/extension/ad-block" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body_json")

  http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
  body=$(echo "$response" | sed '/HTTP_CODE:/d')

  if [ "$http_code" = "200" ]; then
    echo "  ✓ Success"
    ads_count=$(echo "$body" | jq '.ads | length' 2>/dev/null || echo "0")
    notifs_count=$(echo "$body" | jq '.notifications | length' 2>/dev/null || echo "0")
    echo "  Found: $ads_count ad(s), $notifs_count notification(s)"
  else
    echo "  ✗ Failed with HTTP $http_code"
    echo "    $body"
    return 1
  fi
  echo ""
}

test_ad_block "" "Get both ads and notifications (default)"
test_ad_block "ad" "Get ads only"
test_ad_block "notification" "Get notifications only"

echo "=========================================="
echo "Done!"
echo "=========================================="
echo ""
echo "Sample curl (after login):"
echo "  TOKEN=\$(curl -s -X POST \"$BASE_URL/api/extension/auth/login\" \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"$EXTENSION_EMAIL\",\"password\":\"…\"}' | jq -r .token)"
echo "  curl -X POST \"$BASE_URL/api/extension/ad-block\" \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    -d '{\"domain\":\"$DOMAIN\"}'"
echo ""
