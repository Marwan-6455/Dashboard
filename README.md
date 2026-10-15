# CINDERMARCH ENGINE HUB
### Terminal 6 Development Management Platform

Internal engineering platform built for **Cindermarch Studio** to manage the development, verification gates, and code revisions of *Terminal 6*, a psychological horror game set around an abandoned train station.

---

## 1. Quick Start (Run Locally)

### Prerequisites
- Node.js 22+ (tested on Node 24.22.0)
- npm 10+

### Launching the Application
From the repository root (`d:\Dashboard`):

```bash
# 1. Install dependencies
npm install

# 2. Run backend API server (runs on port 3001)
npm run dev:backend

# 3. In another terminal, run frontend dashboard (runs on port 5173)
npm run dev:frontend
```

Once started, open your browser and navigate to:
**`http://localhost:5173`**

---

## 2. Initial Team Accounts & Credentials

The hub is pre-seeded with three studio accounts for Terminal 6 development:

| Role | Username | Display Name | Default Password | Initial Permissions |
|---|---|---|---|---|
| Engine Lead | `lead` | Engine Lead | `Terminal6#Studio` | Admin, Developer, Reviewer |
| Gameplay Programmer | `yehia` | Yehia | `Terminal6#Studio` | Developer, Reviewer |
| Systems / VFX Dev | `joe` | Joe | `Terminal6#Studio` | Developer |

*Note: On the login screen, quick-switch profile chips are provided for rapid switching between developers.*

---

## 3. Core Architecture & Verification Workflows

### The 6 Mandatory Completion Gates
Under Cindermarch engineering standards, a task cannot simply be selected as "Verified Complete" from a dropdown. Backend business logic enforces:

1. **Acceptance Criteria Gate:** All required acceptance criteria must be satisfied in persistent storage.
2. **UVCS Changeset Gate:** At least one relevant Unity Version Control (Plastic SCM) changeset must be linked, unless the task has an authorized and documented exemption.
3. **Independent Peer Review Gate:** Work must be approved by an independent studio reviewer. **Self-approval is strictly rejected by the backend.**
4. **Evidence Artifact Gate:** Tangible evidence (screenshots, gameplay clips, profiler logs) must be attached.
5. **Test Report Gate:** A passing Unity Test Framework or build report must exist for the task or tested revision, unless explicitly exempt.
6. **Dependency Gate:** All prerequisite blocking tasks must be `Verified Complete`.

If any gate fails when attempting completion, the backend returns HTTP 422 with a structured report of all unmet requirements.

---

## 4. Application Navigation & Pages

1. **Overview:** Real-time calculated dashboard statistics (Total open tasks, in progress, awaiting review, blocked, verified complete, developer workload, deadlines, and recent activity).
2. **Tasks:** List and Kanban views with status filters, priority filters, owner filters, search, and detail drawer.
3. **Team:** Directory of Engine Lead, Yehia, and Joe, showing assigned workloads, pending review queues, and role configurations.
4. **Activity:** Immutable, chronological audit log capturing every task update, review decision, and test run.
5. **Reviews:** Dedicated peer review queue with 9-item review checklist and decision submissions.
6. **Test Reports:** Unity Test Framework and build validation outcomes, distinguishing manual entries from automated CI webhooks.
7. **Evidence:** Gallery and download portal for visual captures, profiler logs, and external artifact links.
8. **Integrations:** Status and diagnostic tools for Unity Version Control, automated UTF test webhook ingestion, Discord alerts, and future Unity Editor C# extension.
9. **Settings:** Studio completion gate policy configuration, system health diagnostics, and safe database reseed tools.

---

## 5. Automated Tests

Run backend unit and integration tests:

```bash
# Run backend tests (24 tests)
npm --prefix backend test

# Run discord bot tests (4 tests)
npm --prefix services/discord-bot test

# Or run all test suites from root (28 tests)
npm test
```

Test suite covers:
- Completion gate enforcement (all 6 gates and exemption rules)
- Self-approval prevention on review submissions and completion
- Sequential unique task ID generation (`T6-ENG-001`, `T6-ENG-002`, etc.)
- Authentication, session cookies, and rate limiting
- Evidence upload validation and executable file blocking
- Discord account linking (code generation, single-use hashing, expiration, and unlinking)
- Persistent deadline reminder scheduling (24h, 2h, due_now, daily overdue alerts)
- Automatic reminder cancellation when tasks become `Verified Complete`
- Outbox event queuing, delivery acknowledgment, and exponential retry handling
- Discord slash command schema validation and option constraints

---

## 6. External Integrations Status

- **Cindermarch Operations Bot (Discord Service):** Dedicated standalone service in `services/discord-bot/` running alongside the Hub. Connects to backend via secure internal REST API (`/api/bot`). Supports 11 slash commands (`/help`, `/link`, `/unlink`, `/my-tasks`, `/team-tasks`, `/task`, `/deadlines`, `/standup`, `/subscribe`, `/team`, `/health`), persistent database-backed deadline reminders, and asynchronous outbox event delivery.
- **Unity Version Control (UVCS):** Operating in **Manual Mode**. Changeset IDs (`cs:1042`, etc.) are recorded and linked manually to tasks with honest labeling. Automated sync requires `UNITY_DEVOPS_TOKEN` or local `cm` CLI.
- **Unity Test Framework Ingestion:** Ready for live report ingestion via `POST /api/integrations/unity-test-report` with header `x-api-key: cm-test-ingest-token-t6-dev`.
- **Unity C# Editor Extension:** Architecture planned for post-MVP integration.
