#!/bin/bash

# Script to simulate extension pull requests using REAL data from your database
# This fetches actual platforms and ads, then creates log entries

# Base URL - adjust if your server runs on a different port
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=========================================="
echo "Extension Log Test Script"
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

# Fetch ads from API to verify we have active ads for this domain
# Note: The API requires exact domain match, so we check with the stored domain format
echo "Fetching ads from database..."
ADS_JSON_STORED=$(curl -s "$BASE_URL/api/ads?domain=$PLATFORM_DOMAIN_FULL")
ADS_JSON_CLEAN=$(curl -s "$BASE_URL/api/ads?domain=$DOMAIN")

# Use whichever returns results
if [ -n "$ADS_JSON_STORED" ] && [ "$ADS_JSON_STORED" != "[]" ] && [ "$ADS_JSON_STORED" != "null" ]; then
    ADS_JSON="$ADS_JSON_STORED"
    QUERY_DOMAIN="$PLATFORM_DOMAIN_FULL"
elif [ -n "$ADS_JSON_CLEAN" ] && [ "$ADS_JSON_CLEAN" != "[]" ] && [ "$ADS_JSON_CLEAN" != "null" ]; then
    ADS_JSON="$ADS_JSON_CLEAN"
    QUERY_DOMAIN="$DOMAIN"
else
    ADS_JSON="[]"
    QUERY_DOMAIN="$DOMAIN"
fi

if [ "$ADS_JSON" != "[]" ] && [ -n "$ADS_JSON" ]; then
    if [ "$USE_JQ" = true ]; then
        AD_COUNT=$(echo "$ADS_JSON" | jq '. | length' 2>/dev/null || echo "0")
        if [ "$AD_COUNT" -gt 0 ]; then
            echo "Found $AD_COUNT active ad(s) for this platform:"
            echo "$ADS_JSON" | jq -r '.[] | "  - \(.name) (Status: \(.status))"'
        fi
    else
        echo "Found active ads for this platform"
    fi
else
    echo "Note: No active ads found for this platform"
    echo "The log will still be created, but no ads will be returned by /api/ads"
fi

echo ""
echo "=========================================="
echo "Generating test logs..."
echo "=========================================="
echo ""

# Generate unique visitor ID with timestamp
VISITOR_ID="${VISITOR_ID:-test-visitor-$(date +%s)}"

# Function to log a request
log_request() {
    local request_type=$1
    echo "Logging $request_type request..."
    echo "  Domain: $DOMAIN"
    echo "  Visitor ID: $VISITOR_ID"
    
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/extension/log" \
        -H "Content-Type: application/json" \
        -d "{
      \"visitorId\": \"$VISITOR_ID\",
      \"domain\": \"$DOMAIN\",
      \"requestType\": \"$request_type\"
    }")
    
    http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" = "201" ]; then
        echo "  ✓ Success! Log created for $request_type"
        if [ "$USE_JQ" = true ]; then
            echo "$body" | jq '.' 2>/dev/null | sed 's/^/    /'
        else
            echo "    $body"
        fi
    else
        echo "  ✗ Failed with HTTP $http_code"
        echo "    $body"
        return 1
    fi
    echo ""
}

# Log ad request
log_request "ad"

# Log notification request  
log_request "notification"

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
echo "To test with a different visitor ID:"
echo "  VISITOR_ID=my-custom-id ./test-extension-log.sh"
echo ""
