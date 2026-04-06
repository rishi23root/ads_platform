# Documentation

This directory contains all documentation for the Admin Dashboard and Extension API.

## Documentation Files

### API Documentation
- **[EXTENSION_V2_API.md](./EXTENSION_V2_API.md)** — **v2 extension handoff** (SSE **`live`**, **`serve/redirects`**, **`serve/ads`**, **`events`**), auth, and **[implementation checklist](./EXTENSION_V2_API.md#extension-implementation-checklist)**. Prefer this for new browser-extension work.
- **[EXTENSION_API_DOCS.md](./EXTENSION_API_DOCS.md)** — Summary + legacy **`ad-block`** detail, schemas, and examples.
- **[EXTENSION_API_REFERENCE.md](./EXTENSION_API_REFERENCE.md)** — Older combined reference (may lag v2); includes **`ad-block`** patterns.
- **[EXTENSION_AD_BLOCK_API.md](./EXTENSION_AD_BLOCK_API.md)** — Extension API reference (alternative format).

### Architecture & System Design
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, component design, and API endpoints overview
- **[EXTENSION_AND_DASHBOARD_OVERVIEW.md](./EXTENSION_AND_DASHBOARD_OVERVIEW.md)** - How the extension and dashboard work together, data flow, and optimization strategies
- **[DATABASE.md](./DATABASE.md)** - Database schema, relationships, and data models

### Testing
- **[TEST_EXTENSION_LOG.md](./TEST_EXTENSION_LOG.md)** - Guide for testing the extension API
- **[test-extension-log.sh](./test-extension-log.sh)** - Test script to simulate extension requests

## Quick Start

For extension developers:
1. **Read [EXTENSION_V2_API.md](./EXTENSION_V2_API.md)** — current v2 flows and task checklist.
2. Use [EXTENSION_API_DOCS.md](./EXTENSION_API_DOCS.md) for legacy **`ad-block`** and extra examples.
3. Use [test-extension-log.sh](./test-extension-log.sh) (and `pnpm test:extension-v2` when integration env is set) to validate HTTP.

For system understanding:
1. Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for high-level overview
2. Read [EXTENSION_AND_DASHBOARD_OVERVIEW.md](./EXTENSION_AND_DASHBOARD_OVERVIEW.md) for detailed flow
3. Check [DATABASE.md](./DATABASE.md) for data structure details
