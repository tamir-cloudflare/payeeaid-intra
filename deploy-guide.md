# PayeeAid Intranet — Deployment Guide for Windows Server IIS

## Prerequisites

- Windows Server 2019 or 2022
- IIS enabled
- Node.js 20+ installed ([download](https://nodejs.org/))
- MSSQL Server (Express or full) installed locally
- IIS URL Rewrite module ([download](https://www.iis.net/downloads/microsoft/url-rewrite))
- IIS Application Request Routing (ARR) module — needed for reverse proxy

---

## Step 1 — Create the MSSQL Database

Open SQL Server Management Studio (SSMS) and run:

```sql
CREATE DATABASE PayeeAidIntranet;
GO
USE PayeeAidIntranet;
GO
-- The it_tickets table is created automatically by the API on first run.
-- Just create the database, the API handles the table creation.
```

Create a SQL login (or use existing):

```sql
CREATE LOGIN payeeaid_user WITH PASSWORD = 'YourStrongPassword123!';
GO
USE PayeeAidIntranet;
GO
CREATE USER payeeaid_user FOR LOGIN payeeaid_user;
GO
ALTER ROLE db_owner ADD MEMBER payeeaid_user;
GO
```

---

## Step 2 — Deploy the Website Files to IIS

1. Copy the `intranet` folder to `C:\inetpub\wwwroot\intranet`
2. Open **IIS Manager**
3. Right-click **Sites** → **Add Website**
   - **Site name:** PayeeAid Intranet
   - **Physical path:** `C:\inetpub\wwwroot\intranet`
   - **Binding:** `http://localhost:80` (or port 8080 if 80 is in use)
   - **Host name:** `intranet.payeeaid.local` (optional, for internal DNS)
4. Click **OK**

The `web.config` file in the root handles URL rewriting and security headers automatically.

---

## Step 3 — Install the Node.js API

1. Copy the `api` folder to `C:\inetpub\wwwroot\intranet\api` (or `C:\payeeaid-api`)
2. Open a terminal (Command Prompt as Administrator):

```bash
cd C:\inetpub\wwwroot\intranet\api
npm install
```

3. Update the database credentials in `server.js` (or use environment variables):

```bash
set DB_SERVER=localhost
set DB_NAME=PayeeAidIntranet
set DB_USER=payeeaid_user
set DB_PASSWORD=YourStrongPassword123!
set PORT=3000
```

4. Test the API:

```bash
npm start
```

You should see:
```
✅ Connected to MSSQL: localhost/PayeeAidIntranet
✅ Tables ready
PayeeAid Intranet API running on http://0.0.0.0:3000
```

5. Press Ctrl+C to stop, then install as a Windows Service using **PM2** or **NSSM**:

### Option A — PM2 (recommended)

```bash
npm install -g pm2 pm2-windows-startup
pm2 start server.js --name intranet-api
pm2 save
pm2-startup install
```

### Option B — NSSM

```bash
nssm install PayeeAidIntranetAPI "C:\Program Files\nodejs\node.exe" "C:\inetpub\wwwroot\intranet\api\server.js"
nssm start PayeeAidIntranetAPI
```

---

## Step 4 — Configure IIS Reverse Proxy

The `web.config` already contains the rewrite rule to forward `/api/*` to `http://localhost:3000/api/*`.

Ensure **Application Request Routing (ARR)** is enabled:

1. Open **IIS Manager**
2. Click the server name (root node)
3. Open **Application Request Routing Cache**
4. Click **Server Proxy Settings** (right panel)
5. Check **Enable proxy** → **Apply**

The web.config rewrite rule will now forward all `/api/*` requests to the Node.js API.

---

## Step 5 — Test Everything

1. Open a browser: `http://localhost/` (or `http://localhost:8080/`)
2. Navigate to **IT Support** page
3. Fill in the ticket form and submit
4. The ticket should appear in the "Recent Tickets" list below

Test the API directly:

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/tickets -H "Content-Type: application/json" -d "{\"emp_name\":\"Test User\",\"emp_email\":\"test@payeeaid.com\",\"department\":\"Engineering\",\"category\":\"Network / VPN / WiFi\",\"priority\":\"Medium\",\"subject\":\"VPN not connecting\",\"description\":\"VPN client fails to connect after password reset\"}"
```

---

## Step 6 — Internal DNS (optional)

Add a DNS entry in your Active Directory DNS for the intranet:

1. Open **DNS Manager** on your Domain Controller
2. Add **A record:** `intranet` → Windows Server IP
3. Employees access via `http://intranet.payeeaid.local`

---

## File Structure

```
C:\inetpub\wwwroot\intranet\
├── index.html              ← News page
├── hr.html                 ← HR Rules & Benefits
├── healthcare.html         ← Healthcare Insurance
├── it-support.html         ← IT Support (ticket form)
├── web.config              ← IIS configuration
├── css/
│   └── style.css           ← Warm blue & orange theme
├── js/
│   ├── app.js              ← Shared (accordion, nav)
│   └── tickets.js          ← Ticket form + list
└── api/
    ├── server.js           ← Node.js API (Express + MSSQL)
    ├── package.json        ← Dependencies
    └── node_modules/       ← Created by npm install
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| API returns 502 | Node.js not running — `pm2 restart intranet-api` |
| Tickets not saving | Check MSSQL credentials in server.js |
| `npm install` fails | Run as Administrator, check Node.js version |
| IIS returns 500 | Check ARR proxy is enabled in IIS Manager |
| Form gives network error | Verify Node.js running on port 3000: `curl http://localhost:3000/api/health` |
| CSS not loading | Check IIS has read permissions on the intranet folder |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/tickets` | Create a new IT ticket |
| `GET` | `/api/tickets` | List all tickets (optional `?limit=N`) |
| `GET` | `/api/tickets/:id` | Get a specific ticket |
| `PATCH` | `/api/tickets/:id` | Update ticket status/assignment |
| `GET` | `/api/health` | API health check |
