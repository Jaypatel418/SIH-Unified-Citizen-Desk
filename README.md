# SIH26129 — Unified Citizen Desk (MERN + Microservices)

A hackathon-ready interoperability prototype for integrating independent government digital platforms through a common API Gateway.

## Technology stack

- **MongoDB** — persistent master data, department applications, workflows, sessions, events, notifications and audit logs
- **Express.js** — REST APIs
- **React + Vite** — citizen/officer dashboard
- **Node.js** — gateway and department microservices

> This project now uses MongoDB for persistence. It is a MERN-based frontend/backend stack with separate department microservices behind the Gateway.

## Architecture

```text
React Dashboard (5173)
        |
        v
API Gateway (3000)
 |      |       |
 v      v       v
License Land    Tax
3001   3002    3003
 |      |       |
 v      v       v
MongoDB collections
license_applications
land_applications
tax_applications

Gateway MongoDB collections:
citizens, sessions, workflows, events, notifications, audit_logs
```

Each department owns its own MongoDB collection and API. The Gateway provides unified authentication, consent-gated aggregation, routing, normalization, workflow orchestration, events, notifications, audit history and monitoring.

## MongoDB setup

### Option A — Local MongoDB

Install MongoDB Community Edition and make sure the MongoDB server is running on:

```text
mongodb://127.0.0.1:27017
```

The application automatically uses database:

```text
ucd_sih26129
```

### Option B — MongoDB Atlas

Create a MongoDB Atlas cluster and set `MONGODB_URI` before starting the services:

```bash
export MONGODB_URI='mongodb+srv://USERNAME:PASSWORD@CLUSTER/ucd_sih26129?retryWrites=true&w=majority'
```

You can copy `.env.example` and edit the value if preferred. Never commit real Atlas credentials.

## First-time setup

From the project root:

```bash
chmod +x setup.sh start-all.sh
./setup.sh
```

The setup script installs dependencies for all five applications.

## Run everything

Make sure MongoDB is running, then from the root directory:

```bash
# Option 1 (Recommended, Cross-Platform):
npm start
# or: npm run dev

# Option 2 (Shell script for macOS/Linux):
./start-all.sh
```

Open:

```text
http://localhost:5173
```

Services:

```text
React dashboard   5173
Gateway           3000
License           3001
Land Records      3002
Tax & Revenue     3003
MongoDB           27017 (local)
```

## Demo IDs

| ID | Citizen | License | Land | Tax |
|---|---|---|---|---|
| 123 | Rahul Sharma | Verification | Decision | Under Review |
| 124 | Priya Patel | Under Review | Submitted | — |
| 125 | Amit Shah | Decision | Under Review | — |

Seed data is inserted with MongoDB upserts, so restarting services does not erase it.

## SIH demo flow

1. Citizen login with `123`, `124` or `125`.
2. Give consent and load the unified dashboard.
3. Submit a License, Land or Tax application.
4. Gateway routes the request to the selected department service.
5. The department persists the application in its MongoDB collection.
6. Gateway creates an `APPLICATION_SUBMITTED` event, audit record and citizen notification.
7. Officer login shows applications from all departments.
8. Officer changes an application's workflow stage.
9. Gateway records `APPLICATION_STAGE_CHANGED`, audit history and a citizen notification.
10. Show Event Stream, Audit Trail and Service Health.
11. Demonstrate the Legacy Land connector mapping legacy fields to the common data model.
12. Stop one department service and show failure isolation in the unified dashboard.

## Useful MongoDB checks

With `mongosh`:

```javascript
use ucd_sih26129
show collections

 db.citizens.find().pretty()
 db.license_applications.find().pretty()
 db.land_applications.find().pretty()
 db.tax_applications.find().pretty()
 db.events.find().sort({timestamp:-1}).limit(10).pretty()
 db.audit_logs.find().sort({timestamp:-1}).limit(10).pretty()
 db.notifications.find().sort({timestamp:-1}).limit(10).pretty()
 db.workflows.find().pretty()
```

## Production roadmap

- Replace mock SSO with OAuth 2.0 / OpenID Connect and signed JWTs.
- Add Redis/session management for horizontal scaling.
- Add Kafka/RabbitMQ for a distributed event bus.
- Add API gateway rate limiting, service discovery and distributed tracing.
- Add MongoDB indexes, backups and encryption policies.
- Add real government legacy adapters and external identity providers.
