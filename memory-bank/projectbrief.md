# Project Brief

## Project Name
Admin Dashboard - Ad Replacement Platform

## Purpose
A production-grade admin dashboard for managing advertisements and notifications that are delivered to users via a browser extension. The system provides a complete backend API and administrative interface for content management and analytics.

## Core Requirements

### Functional Requirements
1. **Platform Management**: Create and manage platforms (domains) where ads/notifications will be displayed
2. **Ad Management**: Full CRUD operations for advertisements with scheduling, status management, and platform association
3. **Notification Management**: Create time-bound notifications linked to multiple platforms
4. **Analytics**: Track extension user activity, request logs, and usage statistics
5. **Authentication**: Secure admin authentication with JWT-based sessions
6. **Extension API**: Public RESTful API endpoints for browser extensions to fetch ads and notifications
7. **Request Logging**: Track when extensions fetch content for analytics purposes

### Technical Requirements
- Next.js 16 with App Router
- TypeScript strict mode
- PostgreSQL database with Drizzle ORM
- Redis for caching
- JWT-based authentication
- Server-side rendering for admin dashboard
- RESTful API design
- Responsive UI with shadcn/ui components

## Goals

1. **Admin Experience**: Provide an intuitive interface for managing all content
2. **Extension Integration**: Simple, reliable API for browser extensions
3. **Analytics**: Comprehensive tracking of extension usage and content delivery
4. **Scalability**: Architecture that can handle growth
5. **Security**: Secure authentication and data protection
6. **Maintainability**: Clean code structure with proper documentation

## Scope

### In Scope
- Admin dashboard UI for content management
- RESTful API for extensions
- Database schema for platforms, ads, notifications, users, and logs
- Authentication and authorization
- Analytics and reporting
- Test utilities for development

### Out of Scope (Current Phase)
- Browser extension implementation
- Payment processing
- Multi-tenant support
- Advanced analytics/reporting features
- Email notifications
- User management beyond admin

## Success Criteria
- Admins can manage all content types through the dashboard
- Extensions can reliably fetch ads and notifications via API
- Analytics provide meaningful insights into usage
- System is secure and performant
- Codebase is well-documented and maintainable
