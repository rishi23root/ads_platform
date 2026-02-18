# Documentation

This directory contains all documentation for the Admin Dashboard and Extension API.

## Documentation Files

### API Documentation
- **[EXTENSION_API_REFERENCE.md](./EXTENSION_API_REFERENCE.md)** - **Complete extension API reference** — comprehensive guide with `/api/extension/ad-block` (use `requestType: "notification"` for notifications on extension load), request/response formats (arrays), TypeScript types, code examples, error handling, and best practices. **Start here for extension development.**
- **[EXTENSION_AD_BLOCK_API.md](./EXTENSION_AD_BLOCK_API.md)** - Extension API reference (alternative format)
- **[EXTENSION_API_DOCS.md](./EXTENSION_API_DOCS.md)** - Additional extension API notes and usage patterns

### Architecture & System Design
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, component design, and API endpoints overview
- **[EXTENSION_AND_DASHBOARD_OVERVIEW.md](./EXTENSION_AND_DASHBOARD_OVERVIEW.md)** - How the extension and dashboard work together, data flow, and optimization strategies
- **[DATABASE.md](./DATABASE.md)** - Database schema, relationships, and data models

### Testing
- **[TEST_EXTENSION_LOG.md](./TEST_EXTENSION_LOG.md)** - Guide for testing the extension API
- **[test-extension-log.sh](./test-extension-log.sh)** - Test script to simulate extension requests

## Quick Start

For extension developers:
1. **Read [EXTENSION_API_REFERENCE.md](./EXTENSION_API_REFERENCE.md)** — complete API reference with both endpoints, TypeScript types, code examples, and best practices
2. See [EXTENSION_API_DOCS.md](./EXTENSION_API_DOCS.md) for additional notes
3. Use [test-extension-log.sh](./test-extension-log.sh) to test your integration

For system understanding:
1. Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for high-level overview
2. Read [EXTENSION_AND_DASHBOARD_OVERVIEW.md](./EXTENSION_AND_DASHBOARD_OVERVIEW.md) for detailed flow
3. Check [DATABASE.md](./DATABASE.md) for data structure details
