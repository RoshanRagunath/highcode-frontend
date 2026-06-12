const keyForm = document.getElementById('keyForm');
const keyInput = document.getElementById('keyInput');
const keyBtn = document.getElementById('keyBtn');
const keyMsg = document.getElementById('keyMsg');

function showMsg(text, kind) {
  keyMsg.hidden = false;
  keyMsg.className = 'form-msg ' + (kind || '');
  keyMsg.textContent = text;
}

window.whoami.then(user => {
  if (!user) return;
  document.getElementById('meEmail').textContent = user.email;
  document.getElementById('meName').textContent = user.name || '–';
  document.getElementById('meRole').textContent = user.role;
  if (user.unmapped) {
    keyInput.disabled = true;
    keyBtn.disabled = true;
    showMsg('No Jira project assigned to you yet. Ask an admin to add you on the admin page.', 'error');
  } else {
    keyInput.value = user.jira_key || '';
  }
});

keyForm.addEventListener('submit', async e => {
  e.preventDefault();
  keyMsg.hidden = true;
  keyBtn.disabled = true;
  try {
    const res = await fetch('/api/me', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jira_key: keyInput.value.trim().toUpperCase() })
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) { location.reload(); return; }
    const payload = await res.json();
    if (!res.ok) {
      showMsg(payload.message || payload.error || ('HTTP ' + res.status), 'error');
      return;
    }
    keyInput.value = payload.jira_key;
    showMsg('Saved. New uploads will go to ' + payload.jira_key + '.', 'ok');
  } catch (err) {
    showMsg('Network error: ' + (err.message || err), 'error');
  } finally {
    keyBtn.disabled = false;
  }
});
