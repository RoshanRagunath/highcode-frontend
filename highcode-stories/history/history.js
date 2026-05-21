const historyBody = document.getElementById('historyBody');
const refreshBtn = document.getElementById('refreshBtn');
const filterBtns = document.querySelectorAll('.filter-btn');
const sumUploads = document.getElementById('sumUploads');
const sumEpics = document.getElementById('sumEpics');
const sumStories = document.getElementById('sumStories');
const sumLast = document.getElementById('sumLast');

let allRows = [];
let currentFilter = 'all';

async function loadHistory() {
  historyBody.innerHTML = '<p class="muted">Loading history…</p>';
  try {
    const response = await fetch('/api/history');
    if (!response.ok) {
      historyBody.innerHTML = '<p class="muted">Failed to load history (HTTP ' + response.status + ').</p>';
      return;
    }
    const payload = await response.json();
    allRows = (payload.rows || []).slice().sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
    renderSummary(allRows);
    renderHistory(filterRows(allRows));
  } catch (err) {
    historyBody.innerHTML = '<p class="muted">Failed to load history: ' + (err.message || err) + '</p>';
  }
}

function filterRows(rows) {
  if (currentFilter === 'all') return rows;
  return rows.filter(r => (r.status || '').toLowerCase() === currentFilter);
}

function renderSummary(rows) {
  let epics = 0, stories = 0;
  for (const row of rows) {
    epics += row.epic_count || 0;
    stories += row.story_count || 0;
  }
  sumUploads.textContent = rows.length;
  sumEpics.textContent = epics;
  sumStories.textContent = stories;
  sumLast.textContent = rows.length ? formatDate(rows[0].timestamp) : '–';
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;
}

function renderHistory(rows) {
  if (rows.length === 0) {
    historyBody.innerHTML = '<p class="muted">No uploads match this filter.</p>';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>When</th><th>File</th><th>Status</th><th>Counts</th><th>Issues</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const when = formatDate(row.timestamp);
    const issueLinks = (row.issues_detail || row.issue_keys || [])
      .map(it => {
        if (typeof it === 'string') return { key: it, url: 'https://fizor.atlassian.net/browse/' + it };
        return it;
      })
      .filter(x => x && x.key);

    const keysHtml = issueLinks
      .map(it => '<a href="' + (it.url || '#') + '" target="_blank" rel="noopener">' + escapeHtml(it.key) + '</a>')
      .join(' ');

    tr.innerHTML =
      '<td>' + escapeHtml(when) + '</td>' +
      '<td>' + escapeHtml(row.filename || '-') + ' <span class="muted">(' + escapeHtml(row.file_type || '') + ')</span></td>' +
      '<td><span class="status-pill ' + escapeHtml(row.status || '') + '">' + escapeHtml(row.status || '') + '</span></td>' +
      '<td>' + (row.epic_count || 0) + ' / ' + (row.story_count || 0) + '<div class="muted">epics / stories</div></td>' +
      '<td><div class="keys-list">' + keysHtml + '</div></td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  historyBody.innerHTML = '';
  historyBody.appendChild(table);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderHistory(filterRows(allRows));
  });
});

refreshBtn.addEventListener('click', loadHistory);

loadHistory();
