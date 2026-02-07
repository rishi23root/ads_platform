#!/bin/bash

# Script to simulate extension pull requests using REAL data from your database
# This calls the ad-block endpoint which fetches ads/notifications and automatically logs visits

# Base URL - adjust if your server runs on a different port
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=========================================="
echo "Extension Ad Block Test Script"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Check if jq is available (for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo "Warning: jq not found. Install it for better output formatting."
    echo "On Ubuntu/Debian: sudo apt-get install jq"
    echo "On macOS: brew install jq"
    echo ""
    USE_JQ=false
else
    USE_JQ=true
fi

# Function to extract domain from URL (remove protocol, www, trailing slash)
extract_domain() {
    local url="$1"
    # Remove protocol (http:// or https://)
    url="${url#http://}"
    url="${url#https://}"
    # Remove www.
    url="${url#www.}"
    # Remove trailing slash
    url="${url%/}"
    # Remove path if present (keep only domain)
    url="${url%%/*}"
    echo "$url"
}

# Fetch platforms from API
echo "Fetching platforms from database..."
PLATFORMS_JSON=$(curl -s "$BASE_URL/api/platforms")

if [ $? -ne 0 ] || [ -z "$PLATFORMS_JSON" ]; then
    echo "Error: Failed to fetch platforms. Is the server running at $BASE_URL?"
    exit 1
fi

# Check if we have platforms
PLATFORM_COUNT=$(echo "$PLATFORMS_JSON" | jq '. | length' 2>/dev/null || echo "0")
if [ "$PLATFORM_COUNT" = "0" ] || [ -z "$PLATFORMS_JSON" ] || [ "$PLATFORMS_JSON" = "[]" ]; then
    echo "Warning: No platforms found in database."
    echo "Using default test values..."
    DOMAIN="example.com"
else
    # Get first active platform, or first platform if none active
    if [ "$USE_JQ" = true ]; then
        PLATFORM_DOMAIN_FULL=$(echo "$PLATFORMS_JSON" | jq -r '.[] | select(.isActive == true) | .domain' | head -1)
        if [ -z "$PLATFORM_DOMAIN_FULL" ] || [ "$PLATFORM_DOMAIN_FULL" = "null" ]; then
            PLATFORM_DOMAIN_FULL=$(echo "$PLATFORMS_JSON" | jq -r '.[0].domain')
        fi
        PLATFORM_NAME=$(echo "$PLATFORMS_JSON" | jq -r '.[] | select(.isActive == true) | .name' | head -1)
        if [ -z "$PLATFORM_NAME" ] || [ "$PLATFORM_NAME" = "null" ]; then
            PLATFORM_NAME=$(echo "$PLATFORMS_JSON" | jq -r '.[0].name')
        fi
    else
        # Fallback: try to extract domain manually (basic parsing)
        PLATFORM_DOMAIN_FULL=$(echo "$PLATFORMS_JSON" | grep -o '"domain":"[^"]*"' | head -1 | cut -d'"' -f4)
        PLATFORM_NAME=$(echo "$PLATFORMS_JSON" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    
    DOMAIN=$(extract_domain "$PLATFORM_DOMAIN_FULL")
    echo "Found platform: $PLATFORM_NAME"
    echo "Using domain: $DOMAIN (extracted from: $PLATFORM_DOMAIN_FULL)"
fi

echo ""

# Generate unique visitor ID with timestamp
VISITOR_ID="${VISITOR_ID:-test-visitor-$(date +%s)}"

echo ""
echo "=========================================="
echo "Testing ad-block endpoint..."
echo "=========================================="
echo ""

# Function to call ad-block endpoint
test_ad_block() {
    local request_type=$1
    local description=$2
    
    echo "Testing: $description"
    echo "  Domain: $DOMAIN"
    echo "  Visitor ID: $VISITOR_ID"
    if [ -n "$request_type" ]; then
        echo "  Request Type: $request_type"
    else
        echo "  Request Type: (omitted - will fetch both)"
    fi
    
    if [ -n "$request_type" ]; then
        body_json="{\"visitorId\": \"$VISITOR_ID\", \"domain\": \"$DOMAIN\", \"requestType\": \"$request_type\"}"
    else
        body_json="{\"visitorId\": \"$VISITOR_ID\", \"domain\": \"$DOMAIN\"}"
    fi
    
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/extension/ad-block" \
        -H "Content-Type: application/json" \
        -d "$body_json")
    
    http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" = "200" ]; then
        echo "  ✓ Success! Visit logged automatically"
        if [ "$USE_JQ" = true ]; then
            ads_count=$(echo "$body" | jq '.ads | length' 2>/dev/null || echo "0")
            notifs_count=$(echo "$body" | jq '.notifications | length' 2>/dev/null || echo "0")
            echo "  Found: $ads_count ad(s), $notifs_count notification(s)"
            if [ "$ads_count" -gt 0 ]; then
                echo "  Ads:"
                echo "$body" | jq -r '.ads[] | "    - \(.title)"' 2>/dev/null
            fi
            if [ "$notifs_count" -gt 0 ]; then
                echo "  Notifications:"
                echo "$body" | jq -r '.notifications[] | "    - \(.title)"' 2>/dev/null
            fi
        else
            echo "    Response: $body"
        fi
    else
        echo "  ✗ Failed with HTTP $http_code"
        echo "    $body"
        return 1
    fi
    echo ""
}

# Test with both ads and notifications (default)
test_ad_block "" "Get both ads and notifications"

# Test ads only
test_ad_block "ad" "Get ads only"

# Test notifications only
test_ad_block "notification" "Get notifications only"

echo "=========================================="
echo "Done!"
echo "=========================================="
echo ""
echo "Check your Analytics dashboard at:"
echo "  $BASE_URL/analytics"
echo ""
echo "View ads for this platform at:"
echo "  $BASE_URL/api/ads?domain=$PLATFORM_DOMAIN_FULL"
echo "  (or try: $BASE_URL/api/ads?domain=$DOMAIN)"
echo ""
echo "Test ad-block endpoint directly:"
echo "  curl -X POST $BASE_URL/api/extension/ad-block \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"visitorId\":\"$VISITOR_ID\",\"domain\":\"$DOMAIN\"}'"
echo ""
echo "To test with a different visitor ID:"
echo "  VISITOR_ID=my-custom-id ./test-extension-log.sh"
echo ""
