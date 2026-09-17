// ── PayeeAid Intranet — Shared JavaScript ─────────────────────────

// Accordion toggle
function toggleAccordion(header) {
  const item = header.parentElement;
  item.classList.toggle('open');
}

// Set active nav based on current page
(function() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
})();
