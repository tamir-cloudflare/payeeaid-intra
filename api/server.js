// ── PayeeAid Intranet — IT Ticket API ───────────────────────────────
// Node.js + Express + MSSQL
// Runs on Windows Server, connects to local MSSQL instance
// Configure IIS to reverse proxy /api/* to this Node process on port 3000

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── MSSQL Configuration ──────────────────────────────────────────────
// Update these values for your Windows Server MSSQL instance
const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'PayeeAidIntranet',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrongPassword123!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  port: process.env.DB_PORT || 1433,
};

// ── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Database Connection Pool ────────────────────────────────────────
let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to MSSQL:', dbConfig.server + '/' + dbConfig.database);
  }
  return pool;
}

// ── Create tables on startup ────────────────────────────────────────
async function initDb() {
  const p = await getPool();
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'it_tickets')
    CREATE TABLE it_tickets (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      emp_name      NVARCHAR(200)  NOT NULL,
      emp_email     NVARCHAR(200)  NOT NULL,
      department    NVARCHAR(100)  NOT NULL,
      location      NVARCHAR(100)  DEFAULT 'Remote',
      category      NVARCHAR(100)  NOT NULL,
      priority      NVARCHAR(50)   NOT NULL,
      subject       NVARCHAR(500)  NOT NULL,
      description   NVARCHAR(MAX)  NOT NULL,
      status        NVARCHAR(50)   DEFAULT 'Open',
      assigned_to   NVARCHAR(200)  NULL,
      resolution    NVARCHAR(MAX)  NULL,
      created_at    DATETIME2      DEFAULT GETDATE(),
      updated_at    DATETIME2      DEFAULT GETDATE()
    )
  `);
  console.log('✅ Tables ready');
}

// ── POST /api/tickets — Create new ticket ───────────────────────────
app.post('/api/tickets', async (req, res) => {
  const { emp_name, emp_email, department, location, category, priority, subject, description } = req.body;

  // Validate required fields
  const required = { emp_name, emp_email, department, category, priority, subject, description };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  if (missing.length)
    return res.status(400).json({ error: 'Missing required fields: ' + missing.join(', ') });

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp_email))
    return res.status(400).json({ error: 'Invalid email address.' });

  // Description minimum length
  if (description.trim().length < 10)
    return res.status(400).json({ error: 'Description must be at least 10 characters.' });

  try {
    const p = await getPool();
    const result = await p.request()
      .input('emp_name', sql.NVarChar(200), emp_name)
      .input('emp_email', sql.NVarChar(200), emp_email)
      .input('department', sql.NVarChar(100), department)
      .input('location', sql.NVarChar(100), location || 'Remote')
      .input('category', sql.NVarChar(100), category)
      .input('priority', sql.NVarChar(50), priority)
      .input('subject', sql.NVarChar(500), subject)
      .input('description', sql.NVarChar(sql.MAX), description)
      .query(`
        INSERT INTO it_tickets (emp_name, emp_email, department, location, category, priority, subject, description)
        OUTPUT INSERTED.id
        VALUES (@emp_name, @emp_email, @department, @location, @category, @priority, @subject, @description)
      `);

    const ticketId = result.recordset[0].id;
    console.log('[Tickets] New ticket #' + ticketId + ' from ' + emp_name + ' (' + emp_email + ') — ' + subject);

    return res.status(201).json({
      ok: true,
      ticket_id: ticketId,
      status: 'Open',
      message: 'Ticket submitted successfully. IT team will respond within 4 business hours.',
    });
  } catch (err) {
    console.error('[Tickets] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create ticket.' });
  }
});

// ── GET /api/tickets — List tickets ─────────────────────────────────
app.get('/api/tickets', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const p = await getPool();
    const result = await p.request()
      .input('limit', sql.Int, limit)
      .query('SELECT TOP (@limit) * FROM it_tickets ORDER BY created_at DESC');

    return res.json({
      ok: true,
      count: result.recordset.length,
      tickets: result.recordset,
    });
  } catch (err) {
    console.error('[Tickets] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

// ── GET /api/tickets/:id — Get single ticket ─────────────────────────
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ticket ID.' });

    const p = await getPool();
    const result = await p.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM it_tickets WHERE id = @id');

    if (result.recordset.length === 0)
      return res.status(404).json({ error: 'Ticket not found.' });

    return res.json({ ok: true, ticket: result.recordset[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// ── PATCH /api/tickets/:id — Update status ───────────────────────────
app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, assigned_to, resolution } = req.body;

    const p = await getPool();
    const request = p.request().input('id', sql.Int, id).input('updated_at', sql.DateTime2, new Date());

    let setClauses = ['updated_at = @updated_at'];
    if (status) { request.input('status', sql.NVarChar(50), status); setClauses.push('status = @status'); }
    if (assigned_to) { request.input('assigned_to', sql.NVarChar(200), assigned_to); setClauses.push('assigned_to = @assigned_to'); }
    if (resolution) { request.input('resolution', sql.NVarChar(sql.MAX), resolution); setClauses.push('resolution = @resolution'); }

    await request.query('UPDATE it_tickets SET ' + setClauses.join(', ') + ' WHERE id = @id');

    return res.json({ ok: true, message: 'Ticket updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update ticket.' });
  }
});

// ── GET /api/health — Health check ───────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const p = await getPool();
    await p.request().query('SELECT 1');
    return res.json({
      status: 'healthy',
      database: 'connected',
      uptime: Math.floor(process.uptime()) + 's',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({ status: 'degraded', database: 'error', error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('PayeeAid Intranet API running on http://0.0.0.0:' + PORT);
    console.log('Database:', dbConfig.server + '/' + dbConfig.database);
  });
}).catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
