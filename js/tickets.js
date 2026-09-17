// ── IT Ticket Form — submits to Node.js API (MSSQL) ─────────────────
// API runs on the same IIS server via iisnode or reverse proxy to Node.js

const API_BASE = '/api'; // Adjust if API is on a different port

document.getElementById('ticketForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const btn = document.getElementById('submitBtn');
  const alertDiv = document.getElementById('formAlert');

  // Collect form data
  const data = {
    emp_name: document.getElementById('emp_name').value.trim(),
    emp_email: document.getElementById('emp_email').value.trim(),
    department: document.getElementById('department').value,
    location: document.getElementById('location').value || 'Remote',
    category: document.getElementById('category').value,
    priority: document.getElementById('priority').value,
    subject: document.getElementById('subject').value.trim(),
    description: document.getElementById('description').value.trim(),
  };

  // Validate
  const missing = Object.entries(data)
    .filter(([k, v]) => !v && k !== 'location')
    .map(([k]) => k);
  if (missing.length) {
    alertDiv.innerHTML = '<div class="alert alert-error">⚠️ Please fill in all required fields: ' + missing.join(', ') + '</div>';
    return;
  }

  // Submit
  btn.disabled = true;
  btn.innerHTML = '⏳ Submitting…';
  alertDiv.innerHTML = '';

  try {
    const resp = await fetch(API_BASE + '/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await resp.json();

    if (!resp.ok) throw new Error(result.error || 'Failed to submit ticket');

    alertDiv.innerHTML = '<div class="alert alert-success">✅ <strong>Ticket #' + result.ticket_id + ' submitted!</strong> ' +
      'Our IT team will respond within 4 business hours. A confirmation has been sent to ' + data.emp_email + '.</div>';

    // Reset form
    document.getElementById('ticketForm').reset();

    // Refresh ticket list
    loadTickets();
  } catch (err) {
    alertDiv.innerHTML = '<div class="alert alert-error">❌ ' + err.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🎫 Submit Ticket';
  }
});

// Load recent tickets
async function loadTickets() {
  const container = document.getElementById('ticketList');
  try {
    const resp = await fetch(API_BASE + '/tickets?limit=5');
    const data = await resp.json();

    if (!data.tickets || data.tickets.length === 0) {
      container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--gray-500); font-size: 14px;">No tickets yet. Submit one using the form on the left.</div>';
      return;
    }

    let html = '<table class="ticket-table"><thead><tr><th>ID</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead><tbody>';

    data.tickets.forEach(function(t) {
      var statusClass = 'status-' + (t.status || 'open').replace(/\s/g, '-').toLowerCase();
      var priorityClass = 'priority-' + (t.priority || 'low').toLowerCase();
      html += '<tr>' +
        '<td><strong>#' + t.id + '</strong></td>' +
        '<td>' + escapeHtml(t.subject) + '</td>' +
        '<td>' + escapeHtml(t.category) + '</td>' +
        '<td><span class="' + priorityClass + '">' + escapeHtml(t.priority) + '</span></td>' +
        '<td><span class="ticket-status ' + statusClass + '">' + escapeHtml(t.status || 'Open') + '</span></td>' +
        '<td style="font-size:12px;color:var(--gray-500);">' + formatDate(t.created_at) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--gray-500); font-size: 14px;">Unable to load tickets. The IT ticket API may not be running yet.</div>';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Load tickets on page load
loadTickets();
