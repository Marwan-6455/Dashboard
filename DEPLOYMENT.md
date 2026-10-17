# CINDERMARCH ENGINE HUB — PRODUCTION DEPLOYMENT GUIDE

This guide details how to deploy the Cindermarch Terminal 6 Development Hub for online access by the studio's three developers from different devices.

---

## 1. Hosting Architecture Options

### Option A: Managed Cloud Hosting (Render / Railway / Fly.io / AWS ECS)
- **Frontend:** Static web service or served via reverse proxy (Nginx / Express static).
- **Backend:** Node.js 22+ Docker container or Node service.
- **Database:** Managed PostgreSQL 15+ (Production schema provided in `backend/src/db/postgres_schema.sql`).
- **File Storage:** Persistent volume mounted at `/uploads` or AWS S3 / Cloudflare R2 bucket.

---

## 2. Production Build Commands

```bash
# 1. Build backend TypeScript
npm --prefix backend run build

# 2. Build frontend React bundle (outputs to frontend/dist)
npm --prefix frontend run build
```

---

## 3. PostgreSQL Database Setup

1. Provision a PostgreSQL instance.
2. Run the production SQL migration script:
   ```bash
   psql -h <POSTGRES_HOST> -U <POSTGRES_USER> -d <POSTGRES_DB> -f backend/src/db/postgres_schema.sql
   ```
3. Set `DATABASE_URL` in your production environment variables:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/cindermarch_t6
   ```

---

## 4. Production Environment Variables

Configure the following environment variables on your hosting provider (never commit real secrets to Git):

```ini
PORT=3001
NODE_ENV=production
CLIENT_ORIGIN=https://hub.cindermarch.internal  # Or your public HTTPS domain
SESSION_SECRET=<generate_secure_random_64_char_key>
DATABASE_PATH=/var/data/cindermarch.db           # If using SQLite on persistent volume
DATABASE_URL=postgresql://...                   # If using PostgreSQL

# Integrations
UNITY_DEVOPS_TOKEN=<unity_cloud_org_api_token>
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## 5. Security & HTTPS Requirements

1. **HTTPS Only:** In production, session cookies are configured with `secure: true` and `sameSite: 'lax'`. Browsers will reject cookies over plaintext HTTP.
2. **Reverse Proxy:** Terminate TLS/HTTPS via Cloudflare, AWS ALB, or Nginx.
3. **CORS:** Ensure `CLIENT_ORIGIN` strictly matches the frontend production domain.
4. **Rate Limiting:** Authentication endpoints are rate-limited to 10 attempts per minute per IP.
5. **Path Traversal Protection:** Evidence files are stored using generated UUIDs and served through `/api/evidence/:id/file` with `X-Content-Type-Options: nosniff`.

---

## 6. Backup and Recovery

### SQLite on Persistent Volume
```bash
# Atomic online backup using SQLite VACUUM INTO
sqlite3 data/cindermarch.db "VACUUM INTO 'data/backup_$(date +%Y%m%d_%H%M%S).db';"
```

### PostgreSQL
```bash
pg_dump -Fc -h <HOST> -U <USER> cindermarch_t6 > cindermarch_backup_$(date +%Y%m%d).dump
```

Schedule daily automated snapshots and replicate offsite.

---

## 7. Inviting Yehia and Joe (Team Onboarding)

1. **Sign in as Workspace Owner (Engine Lead):**
   - Access the platform and navigate to the **Team** page (`/team`).
2. **Generate Invitation:**
   - Click the **Invite Team Member** button.
   - Enter `yehia@cindermarch.studio` (or Yehia's actual email) and select role `Developer` or `Reviewer`.
   - Click **Generate Secure Invite**.
   - Copy the generated registration URL (e.g. `https://your-domain.com/signup?invite=inv_...`).
3. **Repeat for Joe:**
   - Enter `joe@cindermarch.studio` and select `Developer`.
   - Copy Joe's registration link.
4. **Member Acceptance:**
   - When Yehia and Joe open their respective invitation links, the Cindermarch Hub verifies the invite token, displays the invitation details, and adds them directly to the **Cindermarch Studio** workspace upon signup.
   - Uninvited registrations create separate isolated workspaces and cannot see Terminal 6 project data.

---

## 8. Multi-Device Local Testing (LAN Access)

To test access from three separate devices on the same local network before public deployment:

1. In `frontend/vite.config.ts`, ensure `server.host: true` (or `--host 0.0.0.0`).
2. Determine the host computer's local IP address (e.g. `192.168.1.100` via `ipconfig`).
3. Update `.env` or run frontend with `VITE_API_URL=http://192.168.1.100:3001`.
4. Open ports `5173` and `3001` in the Windows Defender firewall.
5. On the other two computers/laptops, navigate to `http://192.168.1.100:5173`.
6. Sign in as Yehia and Joe from the separate devices.

---

## 9. Obtaining Your Production URL

When hosting on a cloud provider:

1. **Render.com / Railway / Fly.io:**
   - Deploy backend web service. The provider will assign a public HTTPS URL (e.g., `https://cindermarch-engine-hub-api.onrender.com`).
   - Deploy frontend static site (pointing `VITE_API_URL` to backend URL). The provider assigns `https://cindermarch-engine-hub.onrender.com` (or your custom domain `https://hub.cindermarch.studio`).
2. **Custom Domain Setup:**
   - Add a CNAME record in your DNS provider: `hub.cindermarch.studio` -> `your-provider-host`.
   - Set `CLIENT_ORIGIN=https://hub.cindermarch.studio` in the backend environment variables.

---

## 10. Multi-Device & Multi-User Verification Checklist

Verify across separate devices/browsers:

- [ ] **Account Isolation:** Register an account without an invitation token. Verify it cannot view Cindermarch Studio tasks or members.
- [ ] **Invitation Workflow:** Register using an invitation link. Verify immediate membership in Cindermarch Studio.
- [ ] **Role Permissions:** Verify Developer cannot change their role to Admin or access administrative workspace settings.
- [ ] **Task Creation & Persistence:** Create a task on Device 1; refresh Device 2 and verify it appears with the identical ID.
- [ ] **Independent Peer Review:** Create a review request by Yehia; verify that Yehia cannot approve their own work (HTTP 403 / UI rejection). Have Engine Lead approve on Device 1.
- [ ] **In-App Notifications:** Assign a task to Joe on Device 1; verify Joe's notification bell increments on Device 3.
- [ ] **Phoenix Companion:** Verify the mascot gently roams on both desktop and mobile viewports, reacts to unread events, and respects mute/minimize preferences stored locally.

---

## 11. Cindermarch Operations Bot (Discord Service) Deployment

The **Cindermarch Operations Bot** is a dedicated service located in `services/discord-bot/`. It connects directly to the Engine Hub backend REST API and operates as an independent, persistent worker with durable outbox delivery and scheduled reminder processing.

### Architecture Overview
- **System of Record:** Engine Hub backend & SQLite/PostgreSQL database remain the sole authoritative system of record.
- **Service Separation:** The bot runs as an independent Node.js process and communicates with the backend via internal API (`/api/bot/...`) secured by `INTERNAL_BOT_API_KEY`.
- **Durable Scheduling:** Reminders are persisted in the `scheduled_reminders` database table and survive bot crashes and server reboots.
- **Asynchronous Outbox:** Dashboard mutations (task creation, assignments, reviews, test reports) write to `discord_event_outbox`. The bot polls and delivers events with automatic retries and exponential backoff.
- **Offline Tolerance:** If Discord goes offline, the dashboard continues working seamlessly and events remain queued in the database.

---

### Step-by-Step Discord Application Setup

#### 1. Create Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it **Cindermarch Operations Bot**.
3. Under **General Information**, upload the Cindermarch logo as the application icon and copy the **Application ID** (`DISCORD_CLIENT_ID`).

#### 2. Configure the Bot User
1. Navigate to the **Bot** tab on the left.
2. Click **Reset Token** to generate a new bot token. Copy this token (`DISCORD_BOT_TOKEN`).
3. Set the Bot username to **Cindermarch Operations Bot**.
4. Disable **Public Bot** (unless making it multi-studio public).
5. Gateway Intents: The bot uses slash commands and interaction embeds. Privileged `MESSAGE_CONTENT` intent is **NOT required**.

#### 3. Generate Least-Privilege Bot Invite URL
In the Developer Portal under **OAuth2 ➔ URL Generator**:
- **Scopes:** `bot`, `applications.commands`
- **Bot Permissions:**
  - Send Messages (`2048`)
  - Embed Links (`16384`)
  - Attach Files (`32768`)
  - Read Message History (`65536`)
  - Add Reactions (`64`)
  - Use External Emojis (`262144`)
- **Combined Permission Integer:** `379968`
- Generated Invite URL:
  ```
  https://discord.com/api/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&permissions=379968&scope=bot%20applications.commands
  ```
- Open this URL in your browser and authorize the bot to join your Cindermarch Discord server.

#### 4. Configure Environment Variables
Copy `.env.example` to `.env` (or configure in your production environment):
```ini
# Discord Bot Credentials
DISCORD_BOT_TOKEN=your_bot_token_from_developer_portal
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_GUILD_ID=your_server_guild_id

# Internal Bot API Security Key
INTERNAL_BOT_API_KEY=generate_a_random_64_char_secret_key
HUB_API_URL=http://localhost:3001/api/bot
HUB_WEB_URL=http://localhost:5173
STUDIO_TIMEZONE=Africa/Cairo
```

#### 5. Register Slash Commands
Run the command deployment script:
```bash
# Registers slash commands to your guild for instant testing:
npm run deploy:commands
```
This registers `/help`, `/link`, `/unlink`, `/my-tasks`, `/team-tasks`, `/task`, `/deadlines`, `/standup`, `/subscribe`, `/team`, and `/health`.

#### 6. Run the Bot Service
```bash
# Development (with auto-reload on changes):
npm run dev:bot

# Production (compiled JavaScript):
npm run build:bot
npm run start:bot
```

---

### Step-by-Step Developer Account Linking
1. Any team member (e.g. Yehia or Joe) types `/link` in any server channel or DM with the bot.
2. The bot responds ephemerally with a single-use 6-character code (e.g. `8F2K9A`) and a link to the Hub.
3. The developer logs in to the Engine Hub and opens **Integrations**.
4. In the **Discord Operations Bot** card, they enter the 6-character code and click **Link Account**.
5. The Hub binds their immutable Discord Snowflake ID to their Hub user account and logs an audit activity event.
6. The developer can now use `/my-tasks`, `/task create`, `/task assign`, etc. with full permission enforcement.

---

### Channel Routing & Notifications Configuration
Navigate to the **Integrations** page in the Engine Hub as an administrator to configure:
- **Announcements Channel ID:** Receives new task announcements and verified completions.
- **Engine Team Updates Channel ID:** Receives task assignments, status changes, and deadline updates.
- **QA Build Reports Channel ID:** Receives UTF test runner and CI build ingestion results.
- **Escalation Channel ID:** Receives alerts for tasks marked **Blocked** or overdue tasks.

---

### Process Supervision (Production PM2 Configuration)

Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'cindermarch-hub-backend',
      script: './backend/dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'cindermarch-discord-bot',
      script: './services/discord-bot/dist/index.js',
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```
Start both services:
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 9. Private Cloud 24/7 Deployment (Zero PC Dependency)

To ensure the Cindermarch Studio Operating System remains 100% operational when your personal PC is powered off:

### Architecture Overview

```
                      +---------------------------------------+
                      |       Internet / Cloud Provider       |
                      |   (Railway / Render / Fly.io / VPS)   |
                      +---------------------------------------+
                                          |
                      +---------------------------------------+
                      |       Cloudflare / Managed TLS        |
                      |        https://hub.cindermarch.com    |
                      +---------------------------------------+
                                          |
          +-------------------------------+-------------------------------+
          |                                                               |
+---------------------+                                         +-------------------+
|  Cindermarch Hub    | <------ Private Internal Network -----> |  Discord Worker   |
|  - Web UI (Port 3001)                                         |  - Slash Commands |
|  - REST APIs        |                                         |  - Notifications  |
|  - Task Machine     |                                         +-------------------+
|  - Strike Engine    |                                                   |
|  - Unified Search   |                                             Discord API
+---------------------+
     |             |
     v             v
+----------+ +-----------+
| NVMe Vol | | NVMe Vol  |
| /data    | | /uploads  |
+----------+ +-----------+
```

### Option 1: Docker Compose on Cloud VPS (DigitalOcean / Hetzner / AWS Lightsail)

1. Clone repository to cloud VPS:
   ```bash
   git clone <repo-url> /opt/cindermarch-engine-hub
   cd /opt/cindermarch-engine-hub
   ```
2. Configure `.env` from template:
   ```bash
   cp .env.example .env
   nano .env
   # Set CLIENT_ORIGIN, SESSION_SECRET, INTERNAL_BOT_API_KEY, DISCORD_BOT_TOKEN
   ```
3. Boot full multi-container stack:
   ```bash
   docker compose up -d --build
   ```
4. Verify health:
   ```bash
   curl http://localhost:3001/health
   docker compose logs -f
   ```

### Option 2: Railway.app (One-Click Git Deployment)

1. Connect GitHub repository to Railway.
2. Service 1: `cindermarch-hub`
   - Build Type: Dockerfile
   - Port: 3001
   - Add Persistent Volume mounted at `/app/data` (10GB)
   - Add Persistent Volume mounted at `/app/uploads` (50GB)
   - Add Environment Variables from `.env.example`
3. Service 2: `cindermarch-bot`
   - Command: `node services/discord-bot/dist/index.js`
   - Add Environment Variables (`HUB_API_URL`, `INTERNAL_BOT_API_KEY`, `DISCORD_BOT_TOKEN`)

### Option 3: Render.com Blueprint (`render.yaml`)

```yaml
services:
  - type: web
    name: cindermarch-hub
    env: docker
    dockerfilePath: Dockerfile
    plan: standard
    healthCheckPath: /health
    disk:
      name: cindermarch-data
      mountPath: /app/data
      sizeGB: 10
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: SESSION_SECRET
        generateValue: true
      - key: DISCORD_BOT_TOKEN
        sync: false
      - key: INTERNAL_BOT_API_KEY
        generateValue: true

  - type: worker
    name: cindermarch-discord-bot
    env: docker
    dockerfilePath: Dockerfile
    dockerCommand: node services/discord-bot/dist/index.js
    plan: standard
    envVars:
      - key: HUB_API_URL
        value: http://cindermarch-hub:3001/api/bot
      - key: INTERNAL_BOT_API_KEY
        fromService:
          name: cindermarch-hub
          type: web
          envVarKey: INTERNAL_BOT_API_KEY
      - key: DISCORD_BOT_TOKEN
        sync: false
```

---

