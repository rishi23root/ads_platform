# Product Context

## Why This Project Exists

This admin dashboard is the backend and management interface for an ad replacement system delivered via browser extension. It solves the problem of centrally managing advertisements and notifications that are displayed to users across different websites.

## Problems It Solves

1. **Centralized Content Management**: Instead of managing ads/notifications across multiple systems, everything is managed in one place
2. **Platform-Specific Targeting**: Different content can be shown on different domains/platforms
3. **Scheduling**: Content can be scheduled with start/end dates for time-bound campaigns
4. **Analytics**: Track which content is being served and to whom
5. **Extension Integration**: Simple API for browser extensions to fetch and display content
6. **Status Management**: Control active/inactive content without deletion

## How It Works

### Admin Workflow
1. Admin logs into the dashboard
2. Creates platforms (domains) where content will be displayed
3. Creates ads with images, URLs, and schedules them
4. Creates notifications with messages and date ranges
5. Links notifications to specific platforms
6. Views analytics to see extension usage and content delivery

### Extension Workflow
1. Browser extension detects user is on a configured domain
2. Extension calls API endpoints to fetch active ads and notifications
3. Extension displays content to user
4. Extension logs requests for analytics
5. Analytics appear in admin dashboard

### Content Lifecycle
- **Ads**: Created → Scheduled → Active → Expired (automatic) or Inactive (manual)
- **Notifications**: Created → Active (within date range) → Expired (after end date)
- **Platforms**: Created → Active/Inactive toggle

## User Experience Goals

### For Admins
- **Intuitive**: Easy to navigate and understand
- **Efficient**: Quick access to create/edit content
- **Informative**: Clear analytics and statistics
- **Reliable**: Consistent behavior and error handling
- **Fast**: Quick page loads and responsive interactions

### For Extension Developers
- **Simple**: Easy-to-use API endpoints
- **Reliable**: Consistent responses and error handling
- **Documented**: Clear API documentation with examples
- **Fast**: Low latency responses
- **Flexible**: Support for various use cases

## Target Users

### Primary Users
- **Admin Users**: Content managers who create and manage ads/notifications
- **Extension Developers**: Developers building browser extensions that consume the API

### Secondary Users
- **End Users**: Browser extension users who see the ads/notifications (indirect users)

## Key Features

1. **Dashboard Overview**: Quick stats and recent activity
2. **Platform Management**: CRUD operations for domains
3. **Ad Management**: Full lifecycle management with scheduling
4. **Notification Management**: Time-bound messages with multi-platform support
5. **Analytics**: User tracking and request logging
6. **Extension API**: Public endpoints for content fetching
7. **Test Utilities**: Scripts for testing extension integration

## Business Value

- Enables centralized management of advertising content
- Provides analytics for understanding user engagement
- Supports scheduled campaigns and time-bound content
- Facilitates extension integration with simple API
- Reduces manual work through automation (auto-expiration, etc.)
