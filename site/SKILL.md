---
name: pocketbase
description: Comprehensive PocketBase development and deployment skill providing setup guides, schema templates, security patterns, API examples, data management scripts, and real-time integration patterns for building backend services with PocketBase.
---

# PocketBase Skill - Comprehensive Reference

## Overview

This skill provides modular, searchable documentation for PocketBase development. Use the table of contents below to navigate to specific topics. The researcher-pocketbase agent can efficiently search and extract information from the reference files based on your query. PocketBase is an open source backend in 1 file. It provides a realtime database, authentication, file storage, an admin dashboard and is extendable to much more.

## Quick Navigation

### For Newcomers
→ Start with [Introduction](references/introduction.md) for basic concepts
→ Review [How to Use](references/how-to-use.md) for getting started
→ See [Collections](references/collections.md) to understand data modeling
→ Check [Authentication](references/authentication.md) for user management

### For Implementation
→ Use [Records API](references/api/records.md) for CRUD operations
→ Implement [Realtime API](references/api/realtime.md) for live updates
→ Follow [Files Handling](references/files-handling.md) for file uploads
→ Read [Working with Relations](references/working-with-relations.md) for data relationships
→ Check [API Rules & Filters](references/api-rules-and-filters.md) for security

### For Production
→ See [Going to Production](references/going-to-production.md) for deployment
→ Review [PostgreSQL](references/postgresql.md) for database configuration
→ Check [Secrets](references/secrets.md) for credential management
→ Learn [Jobs](references/jobs.md) for background tasks
→ Use [Proxy](references/proxy.md) for API gateway and external service integration

### For Advanced Users (Go Extensions)
→ Explore [Go Overview](references/go/overview.md) for custom functionality
→ Study [Go Event Hooks](references/go/event-hooks.md) for automation
→ Learn [Go Database](references/go/database.md) for advanced queries
→ Check [Go Routing](references/go/routing.md) for custom endpoints

### For Advanced Users (JavaScript Extensions)
→ Explore [JS Overview](references/js/overview.md) for JSVM extensions
→ Study [JS Event Hooks](references/js/event-hooks.md) for automation
→ Learn [JS Database](references/js/database.md) for queries
→ Check [JS Routing](references/js/routing.md) for custom routes

---

## Table of Contents

### Core Concepts & Setup
| Topic | Description | When to Use |
|-------|-------------|-------------|
| [Introduction](references/introduction.md) | What is PocketBase, basic concepts | First time learning about PocketBase |
| [How to Use](references/how-to-use.md) | Installation, quick start, basic usage | Getting started with PocketBase |
| [Use as Framework](references/use-as-framework.md) | Extending PocketBase with Go/JS | Building custom applications |
| [Collections](references/collections.md) | Collection types, schema design, indexes | Designing data models |
| [Authentication](references/authentication.md) | User registration, login, OAuth2, MFA | Building user accounts, login systems |
| [API Rules & Filters](references/api-rules-and-filters.md) | Security rules, filtering, sorting | Controlling data access |
| [Files Handling](references/files-handling.md) | File uploads, thumbnails, storage | Managing file uploads |
| [Working with Relations](references/working-with-relations.md) | One-to-many, many-to-many relationships | Building complex data models |
| [Going to Production](references/going-to-production.md) | Deployment, security, monitoring | Moving to production |
| [PostgreSQL](references/postgresql.md) | PostgreSQL configuration, migrations | Database setup and optimization |
| [Secrets](references/secrets.md) | Credential management, environment variables | Secure configuration |
| [Jobs](references/jobs.md) | Background jobs, scheduled tasks | Async processing |
| [Proxy](references/proxy.md) | API gateway, external service proxy, key protection | Integrating external APIs (LLM, Stripe, etc.) |
| [FAQ](references/faq.md) | Common questions and answers | Troubleshooting |

---

### API Reference
| Endpoint | Description | Reference File |
|----------|-------------|----------------|
| Records API | CRUD operations, pagination, filtering, batch operations | [records.md](references/api/records.md) |
| Realtime API | WebSocket subscriptions, live updates, event handling | [realtime.md](references/api/realtime.md) |
| Files API | File uploads, downloads, thumbnails, access control | [files.md](references/api/files.md) |
| Collections API | Manage collections, schemas, rules, indexes | [collections.md](references/api/collections.md) |
| Settings API | App configuration, CORS, SMTP, general settings | [settings.md](references/api/settings.md) |
| Logs API | Access logs, authentication logs, request logs | [logs.md](references/api/logs.md) |
| Traces API | Distributed tracing, span queries, performance analysis | [traces.md](references/api/traces.md) |
| Analytics API | Page views, visitors, traffic sources, device stats | [analytics.md](references/api/analytics.md) |
| Crons API | Background jobs, scheduled tasks, automation | [crons.md](references/api/crons.md) |
| Backups API | Database backups, data export, disaster recovery | [backups.md](references/api/backups.md) |
| Health API | System health, metrics, performance monitoring | [health.md](references/api/health.md) |

---

### Go Extension Framework
| Topic | Description | Reference File |
|-------|-------------|----------------|
| Go Overview | Project structure, basic concepts, getting started | [overview.md](references/go/overview.md) |
| Event Hooks | Before/After hooks, custom logic, automation | [event-hooks.md](references/go/event-hooks.md) |
| Routing | Custom API endpoints, middleware, handlers | [routing.md](references/go/routing.md) |
| Database | Query builder, transactions, advanced queries | [database.md](references/go/database.md) |
| Records | Record CRUD, validation, custom fields | [records.md](references/go/records.md) |
| Collections | Dynamic schemas, collection management | [collections.md](references/go/collections.md) |
| Migrations | Schema changes, version control, deployment | [migrations.md](references/go/migrations.md) |
| Jobs & Scheduling | Background tasks, cron jobs, queues | [jobs-scheduling.md](references/go/jobs-scheduling.md) |
| Sending Emails | SMTP configuration, templated emails | [sending-emails.md](references/go/sending-emails.md) |
| Rendering Templates | HTML templates, email templates | [rendering-templates.md](references/go/rendering-templates.md) |
| Console Commands | CLI commands, migrations, maintenance | [console-commands.md](references/go/console-commands.md) |
| Realtime | Custom realtime logic, event handling | [realtime.md](references/go/realtime.md) |
| File System | File storage, external storage providers | [filesystem.md](references/go/filesystem.md) |
| Logging | Structured logging, monitoring, debugging | [logging.md](references/go/logging.md) |
| Testing | Unit tests, integration tests, test helpers | [testing.md](references/go/testing.md) |
| Miscellaneous | Advanced features, utilities, tips | [miscellaneous.md](references/go/miscellaneous.md) |
| Record Proxy | Dynamic record behavior, computed fields | [record-proxy.md](references/go/record-proxy.md) |

---

### JavaScript Extension Framework (JSVM)
| Topic | Description | Reference File |
|-------|-------------|----------------|
| JS Overview | JSVM basics, getting started | [overview.md](references/js/overview.md) |
| Event Hooks | Before/After hooks in JavaScript | [event-hooks.md](references/js/event-hooks.md) |
| Routing | Custom routes in JavaScript | [routing.md](references/js/routing.md) |
| Database | Database queries in JavaScript | [database.md](references/js/database.md) |
| Records | Record operations in JavaScript | [records.md](references/js/records.md) |
| Collections | Collection management in JavaScript | [collections.md](references/js/collections.md) |
| Migrations | Schema migrations in JavaScript | [migrations.md](references/js/migrations.md) |
| Jobs & Scheduling | Background jobs in JavaScript | [jobs-scheduling.md](references/js/jobs-scheduling.md) |
| Sending Emails | Email sending in JavaScript | [sending-emails.md](references/js/sending-emails.md) |
| Rendering Templates | Template rendering in JavaScript | [rendering-templates.md](references/js/rendering-templates.md) |
| Console Commands | CLI commands in JavaScript | [console-commands.md](references/js/console-commands.md) |
| Realtime | Realtime handling in JavaScript | [realtime.md](references/js/realtime.md) |
| File System | File operations in JavaScript | [filesystem.md](references/js/filesystem.md) |
| Logging | Logging in JavaScript | [logging.md](references/js/logging.md) |
| HTTP Requests | Sending HTTP requests in JavaScript | [sending-http-requests.md](references/js/sending-http-requests.md) |

---

## File Locations

### Core Documentation
```
/references/
├── introduction.md             # What is PocketBase
├── how-to-use.md               # Getting started guide
├── use-as-framework.md         # Extending PocketBase
├── collections.md              # Data modeling
├── authentication.md           # User management
├── api-rules-and-filters.md    # Security and querying
├── files-handling.md           # File uploads
├── working-with-relations.md   # Data relationships
├── going-to-production.md      # Deployment guide
├── postgresql.md               # PostgreSQL configuration
├── secrets.md                  # Credential management
├── jobs.md                     # Background jobs
├── proxy.md                    # API gateway and proxy
├── faq.md                      # Common questions
└── index.md                    # Documentation index
```

### API Reference
```
/references/api/
├── records.md                  # CRUD operations
├── realtime.md                 # WebSocket subscriptions
├── files.md                    # File management
├── collections.md              # Collection operations
├── settings.md                 # App configuration
├── logs.md                     # Logging
├── traces.md                   # Distributed tracing
├── analytics.md                # Web analytics
├── crons.md                    # Background jobs
├── backups.md                  # Backups
└── health.md                   # Health checks
```

### Go Extensions
```
/references/go/
├── overview.md                 # Getting started
├── event-hooks.md              # Event system
├── routing.md                  # Custom routes
├── database.md                 # Database operations
├── records.md                  # Record management
├── collections.md              # Collection management
├── migrations.md               # Schema changes
├── jobs-scheduling.md          # Background tasks
├── sending-emails.md           # Email integration
├── rendering-templates.md      # Templates
├── console-commands.md         # CLI tools
├── realtime.md                 # Custom realtime
├── filesystem.md               # File storage
├── logging.md                  # Logging
├── testing.md                  # Testing
├── miscellaneous.md            # Advanced topics
└── record-proxy.md             # Dynamic behavior
```

### JavaScript Extensions (JSVM)
```
/references/js/
├── overview.md                 # Getting started
├── event-hooks.md              # Event system
├── routing.md                  # Custom routes
├── database.md                 # Database operations
├── records.md                  # Record management
├── collections.md              # Collection management
├── migrations.md               # Schema changes
├── jobs-scheduling.md          # Background tasks
├── sending-emails.md           # Email integration
├── rendering-templates.md      # Templates
├── console-commands.md         # CLI tools
├── realtime.md                 # Custom realtime
├── filesystem.md               # File storage
├── logging.md                  # Logging
└── sending-http-requests.md    # HTTP requests
```

---

## How to Use This Skill

### For the Researcher-Pocketbase Agent

This skill is designed for efficient information retrieval. When researching PocketBase topics:

1. **Start with Core Concepts** - Review `references/` root files for foundational knowledge
2. **Find API Details** - Use `references/api/` for specific API endpoints
3. **Look up Go Extensions** - Check `references/go/` for Go custom functionality
4. **Look up JS Extensions** - Check `references/js/` for JavaScript custom functionality

### Common Query Patterns

**"How do I..."**
- How do I create a collection? → Collections
- How do I set up authentication? → Authentication
- How do I upload files? → Files Handling
- How do I add real-time updates? → Realtime API

**"How to configure..."**
- How to configure production? → Going to Production
- How to set up security rules? → API Rules & Filters
- How to create custom endpoints? → Go Routing / JS Routing
- How to schedule jobs? → Jobs
- How to proxy external APIs? → Proxy

**"What's the best way to..."**
- What's the best way to structure my data? → Collections, Working with Relations
- What's the best way to secure my API? → API Rules & Filters
- What's the best way to handle files? → Files Handling

**"Error:..."**
- CORS errors → Authentication, Going to Production
- Permission errors → API Rules & Filters
- File upload errors → Files Handling

---

## Notes for Researchers

This skill contains 40+ reference files covering all aspects of PocketBase development. The researcher-pocketbase agent should:

1. Match queries to appropriate topic areas
2. Extract specific information from relevant files
3. Provide comprehensive answers using multiple references
4. Suggest related topics for further reading
5. Identify best practices and common pitfalls

Each reference file is self-contained with examples, explanations, and best practices. Use the table of contents above to quickly navigate to the most relevant information for any PocketBase-related question.
