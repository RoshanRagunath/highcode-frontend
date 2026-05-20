const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.markdown'];

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const resultsBody = document.getElementById('resultsBody');
const historyBody = document.getElementById('historyBody');
const refreshBtn = document.getElementById('refreshBtn');

function getExtension(name) {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf('.');
  return idx === -1 ? '' : lower.slice(idx);
}

function showStatus(text, kind) {
  statusEl.hidden = false;
  statusEl.className = 'status ' + (kind || '');
  statusEl.textContent = text;
}

function hideResults() {
  resultsEl.hidden = true;
  resultsBody.innerHTML = '';
}

function renderResults(payload) {
  resultsEl.hidden = false;
  const issues = payload.issues || [];
  if (issues.length === 0) {
    resultsBody.innerHTML = '<p class="muted">No issues created.</p>';
    return;
  }
  const list = document.createElement('ul');
  list.className = 'issue-list';
  for (const issue of issues) {
    const li = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'badge ' + (issue.type === 'epic' ? 'epic' : 'story');
    badge.textContent = issue.type;
    const link = document.createElement('a');
    if (issue.url) {
      link.href = issue.url;
      link.target = '_blank';
      link.rel = 'noopener';
    }
    link.textContent = issue.key || '(not created)';
    const summary = document.createElement('span');
    summary.className = 'summary';
    summary.textContent = issue.summary || '';
    li.appendChild(badge);
    li.appendChild(link);
    li.appendChild(summary);
    list.appendChild(li);
  }
  resultsBody.appendChild(list);
}

async function readDocxAsMarkdown(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function uploadFile(file) {
  hideResults();
  const ext = getExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    showStatus('Unsupported file type. Use PDF, DOCX, or Markdown.', 'error');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    showStatus('File is larger than 10 MB. Trim the document and try again.', 'error');
    return;
  }

  let payloadFile = file;
  let payloadName = file.name;

  if (ext === '.docx') {
    showStatus('Converting DOCX to text in the browser…', 'working');
    try {
      const text = await readDocxAsMarkdown(file);
      payloadFile = new File([text], file.name.replace(/\.docx$/i, '.md'), { type: 'text/markdown' });
      payloadName = payloadFile.name;
    } catch (err) {
      showStatus('Failed to read the DOCX file: ' + (err.message || err), 'error');
      return;
    }
  }

  showStatus('Uploading ' + payloadName + ' (' + Math.round(payloadFile.size / 1024) + ' KB)…', 'working');

  const fd = new FormData();
  fd.append('file', payloadFile, payloadName);

  let response, payload;
  try {
    response = await fetch('/userstories/api/ingest', {
      method: 'POST',
      body: fd
    });
    payload = await response.json();
  } catch (err) {
    showStatus('Network error: ' + (err.message || err), 'error');
    return;
  }

  if (!response.ok && response.status !== 200) {
    const msg = (payload && payload.error_message) || (payload && payload.message) || ('HTTP ' + response.status);
    showStatus('Upload failed: ' + msg, 'error');
    return;
  }

  const status = payload.status || 'success';
  const issueCount = (payload.issues || []).length;
  const summaryText =
    status === 'success'
      ? 'Created ' + issueCount + ' issue(s) — ' + (payload.epic_count || 0) + ' epic(s), ' + (payload.story_count || 0) + ' story(ies).'
      : status === 'partial'
        ? 'Partial result: ' + (payload.error_message || 'see details below.')
        : 'Upload finished with errors: ' + (payload.error_message || 'unknown.');
  showStatus(summaryText, status);
  renderResults(payload);
  loadHistory();
}

async function loadHistory() {
  historyBody.innerHTML = '<p class="muted">Loading history…</p>';
  try {
    const response = await fetch('/userstories/api/history');
    if (!response.ok) {
      historyBody.innerHTML = '<p class="muted">Failed to load history (HTTP ' + response.status + ').</p>';
      return;
    }
    const payload = await response.json();
    renderHistory(payload.rows || []);
  } catch (err) {
    historyBody.innerHTML = '<p class="muted">Failed to load history: ' + (err.message || err) + '</p>';
  }
}

function renderHistory(rows) {
  if (rows.length === 0) {
    historyBody.innerHTML = '<p class="muted">No uploads yet.</p>';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>When</th><th>File</th><th>Status</th><th>Counts</th><th>Issues</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const when = row.timestamp ? new Date(row.timestamp).toLocaleString() : '—';
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
      '<td>' + escapeHtml(row.filename || '—') + ' <span class="muted">(' + escapeHtml(row.file_type || '') + ')</span></td>' +
      '<td><span class="status-pill ' + escapeHtml(row.status || '') + '">' + escapeHtml(row.status || '') + '</span></td>' +
      '<td>' + (row.epic_count || 0) + ' / ' + (row.story_count || 0) + '<div class="muted" style="font-size:11px">epics / stories</div></td>' +
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

dropzone.addEventListener('click', e => {
  if (e.target === browseBtn) return;
  fileInput.click();
});
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });

['dragenter', 'dragover'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); })
);
dropzone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) uploadFile(file);
  e.target.value = '';
});
refreshBtn.addEventListener('click', loadHistory);

loadHistory();
