---
name: pocketbase
description: Comprehensive PocketBase development and deployment skill providing setup guides, schema templates, security patterns, API examples, data management scripts, and real-time integration patterns for building backend services with PocketBase.
---

# PocketBase Skill - Comprehensive Reference

## Overview

This skill provides modular, searchable documentation for PocketBase development. Use the table of contents below to navigate to specific topics. The researcher-pocketbase agent can efficiently search and extract information from the reference files based on your query. PocketBase is an open source backend in 1 file. It provides a realtime database, authentication, file storage, an admin dashboard and is extendable to much more.

## Quick Navigation

### For Newcomers
→ Start with [Introduction](references/en/introduction.md) for basic concepts
→ Review [How to Use](references/en/how-to-use.md) for getting started
→ See [Collections](references/en/collections.md) to understand data modeling
→ Check [Authentication](references/en/authentication.md) for user management

### For Implementation
→ Use [Records API](references/en/api/records.md) for CRUD operations
→ Implement [Realtime API](references/en/api/realtime.md) for live updates
→ Follow [Files Handling](references/en/files-handling.md) for file uploads
→ Read [Working with Relations](references/en/working-with-relations.md) for data relationships
→ Check [API Rules & Filters](references/en/api-rules-and-filters.md) for security

### For Production
→ See [Going to Production](references/en/going-to-production.md) for deployment
→ Review [PostgreSQL](references/en/postgresql.md) for database configuration
→ Check [Secrets](references/en/secrets.md) for credential management
→ Learn [Jobs](references/en/jobs.md) for background tasks
→ Use [Proxy](references/en/proxy.md) for API gateway and external service integration

### For Advanced Users (Go Extensions)
→ Explore [Go Overview](references/en/go/overview.md) for custom functionality
→ Study [Go Event Hooks](references/en/go/event-hooks.md) for automation
→ Learn [Go Database](references/en/go/database.md) for advanced queries
→ Check [Go Routing](references/en/go/routing.md) for custom endpoints

### For Advanced Users (JavaScript Extensions)
→ Explore [JS Overview](references/en/js/overview.md) for JSVM extensions
→ Study [JS Event Hooks](references/en/js/event-hooks.md) for automation
→ Learn [JS Database](references/en/js/database.md) for queries
→ Check [JS Routing](references/en/js/routing.md) for custom routes

---

## Table of Contents

### Core Concepts & Setup
| Topic | Description | When to Use |
|-------|-------------|-------------|
| [Introduction](references/en/introduction.md) | What is PocketBase, basic concepts | First time learning about PocketBase |
| [How to Use](references/en/how-to-use.md) | Installation, quick start, basic usage | Getting started with PocketBase |
| [Use as Framework](references/en/use-as-framework.md) | Extending PocketBase with Go/JS | Building custom applications |
| [Collections](references/en/collections.md) | Collection types, schema design, indexes | Designing data models |
| [Authentication](references/en/authentication.md) | User registration, login, OAuth2, MFA | Building user accounts, login systems |
| [API Rules & Filters](references/en/api-rules-and-filters.md) | Security rules, filtering, sorting | Controlling data access |
| [Files Handling](references/en/files-handling.md) | File uploads, thumbnails, storage | Managing file uploads |
| [Working with Relations](references/en/working-with-relations.md) | One-to-many, many-to-many relationships | Building complex data models |
| [Going to Production](references/en/going-to-production.md) | Deployment, security, monitoring | Moving to production |
| [PostgreSQL](references/en/postgresql.md) | PostgreSQL configuration, migrations | Database setup and optimization |
| [Secrets](references/en/secrets.md) | Credential management, environment variables | Secure configuration |
| [Jobs](references/en/jobs.md) | Background jobs, scheduled tasks | Async processing |
| [Proxy](references/en/proxy.md) | API gateway, external service proxy, key protection | Integrating external APIs (LLM, Stripe, etc.) |
| [FAQ](references/en/faq.md) | Common questions and answers | Troubleshooting |

---

### API Reference
| Endpoint | Description | Reference File |
|----------|-------------|----------------|
| Records API | CRUD operations, pagination, filtering, batch operations | [records.md](references/en/api/records.md) |
| Realtime API | WebSocket subscriptions, live updates, event handling | [realtime.md](references/en/api/realtime.md) |
| Files API | File uploads, downloads, thumbnails, access control | [files.md](references/en/api/files.md) |
| Collections API | Manage collections, schemas, rules, indexes | [collections.md](references/en/api/collections.md) |
| Settings API | App configuration, CORS, SMTP, general settings | [settings.md](references/en/api/settings.md) |
| Logs API | Access logs, authentication logs, request logs | [logs.md](references/en/api/logs.md) |
| Crons API | Background jobs, scheduled tasks, automation | [crons.md](references/en/api/crons.md) |
| Backups API | Database backups, data export, disaster recovery | [backups.md](references/en/api/backups.md) |
| Health API | System health, metrics, performance monitoring | [health.md](references/en/api/health.md) |

---

### Go Extension Framework
| Topic | Description | Reference File |
|-------|-------------|----------------|
| Go Overview | Project structure, basic concepts, getting started | [overview.md](references/en/go/overview.md) |
| Event Hooks | Before/After hooks, custom logic, automation | [event-hooks.md](references/en/go/event-hooks.md) |
| Routing | Custom API endpoints, middleware, handlers | [routing.md](references/en/go/routing.md) |
| Database | Query builder, transactions, advanced queries | [database.md](references/en/go/database.md) |
| Records | Record CRUD, validation, custom fields | [records.md](references/en/go/records.md) |
| Collections | Dynamic schemas, collection management | [collections.md](references/en/go/collections.md) |
| Migrations | Schema changes, version control, deployment | [migrations.md](references/en/go/migrations.md) |
| Jobs & Scheduling | Background tasks, cron jobs, queues | [jobs-scheduling.md](references/en/go/jobs-scheduling.md) |
| Sending Emails | SMTP configuration, templated emails | [sending-emails.md](references/en/go/sending-emails.md) |
| Rendering Templates | HTML templates, email templates | [rendering-templates.md](references/en/go/rendering-templates.md) |
| Console Commands | CLI commands, migrations, maintenance | [console-commands.md](references/en/go/console-commands.md) |
| Realtime | Custom realtime logic, event handling | [realtime.md](references/en/go/realtime.md) |
| File System | File storage, external storage providers | [filesystem.md](references/en/go/filesystem.md) |
| Logging | Structured logging, monitoring, debugging | [logging.md](references/en/go/logging.md) |
| Testing | Unit tests, integration tests, test helpers | [testing.md](references/en/go/testing.md) |
| Miscellaneous | Advanced features, utilities, tips | [miscellaneous.md](references/en/go/miscellaneous.md) |
| Record Proxy | Dynamic record behavior, computed fields | [record-proxy.md](references/en/go/record-proxy.md) |

---

### JavaScript Extension Framework (JSVM)
| Topic | Description | Reference File |
|-------|-------------|----------------|
| JS Overview | JSVM basics, getting started | [overview.md](references/en/js/overview.md) |
| Event Hooks | Before/After hooks in JavaScript | [event-hooks.md](references/en/js/event-hooks.md) |
| Routing | Custom routes in JavaScript | [routing.md](references/en/js/routing.md) |
| Database | Database queries in JavaScript | [database.md](references/en/js/database.md) |
| Records | Record operations in JavaScript | [records.md](references/en/js/records.md) |
| Collections | Collection management in JavaScript | [collections.md](references/en/js/collections.md) |
| Migrations | Schema migrations in JavaScript | [migrations.md](references/en/js/migrations.md) |
| Jobs & Scheduling | Background jobs in JavaScript | [jobs-scheduling.md](references/en/js/jobs-scheduling.md) |
| Sending Emails | Email sending in JavaScript | [sending-emails.md](references/en/js/sending-emails.md) |
| Rendering Templates | Template rendering in JavaScript | [rendering-templates.md](references/en/js/rendering-templates.md) |
| Console Commands | CLI commands in JavaScript | [console-commands.md](references/en/js/console-commands.md) |
| Realtime | Realtime handling in JavaScript | [realtime.md](references/en/js/realtime.md) |
| File System | File operations in JavaScript | [filesystem.md](references/en/js/filesystem.md) |
| Logging | Logging in JavaScript | [logging.md](references/en/js/logging.md) |
| HTTP Requests | Sending HTTP requests in JavaScript | [sending-http-requests.md](references/en/js/sending-http-requests.md) |

---

## File Locations

### Core Documentation
```
/references/en/
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
/references/en/api/
├── records.md                  # CRUD operations
├── realtime.md                 # WebSocket subscriptions
├── files.md                    # File management
├── collections.md              # Collection operations
├── settings.md                 # App configuration
├── logs.md                     # Logging
├── crons.md                    # Background jobs
├── backups.md                  # Backups
└── health.md                   # Health checks
```

### Go Extensions
```
/references/en/go/
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
/references/en/js/
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

1. **Start with Core Concepts** - Review `references/en/` root files for foundational knowledge
2. **Find API Details** - Use `references/en/api/` for specific API endpoints
3. **Look up Go Extensions** - Check `references/en/go/` for Go custom functionality
4. **Look up JS Extensions** - Check `references/en/js/` for JavaScript custom functionality

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
