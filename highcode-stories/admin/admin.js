const usersBody = document.getElementById('usersBody');
const addForm = document.getElementById('addForm');
const addBtn = document.getElementById('addBtn');
const addMsg = document.getElementById('addMsg');

let me = null;

function showAddMsg(text, kind) {
  addMsg.hidden = false;
  addMsg.className = 'form-msg ' + (kind || '');
  addMsg.textContent = text;
}

async function apiJson(url, options) {
  const res = await fetch(url, options);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    // Access session expired: reload so it can re-prompt.
    location.reload();
    throw new Error('session expired');
  }
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || payload.error || ('HTTP ' + res.status));
  }
  return payload;
}

async function loadUsers() {
  usersBody.innerHTML = '<p class="muted">Loading users…</p>';
  try {
    const payload = await apiJson('/api/admin/users');
    renderUsers(payload.users || []);
  } catch (err) {
    usersBody.innerHTML = '<p class="muted">Failed to load users: ' + escapeHtml(err.message) + '</p>';
  }
}

function renderUsers(users) {
  if (users.length === 0) {
    usersBody.innerHTML = '<p class="muted">No users yet.</p>';
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Email</th><th>Name</th><th>Jira project</th><th>Role</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');

  for (const user of users) {
    const tr = document.createElement('tr');

    const tdEmail = document.createElement('td');
    tdEmail.textContent = user.email;
    if (me && user.id === me.id) {
      const you = document.createElement('span');
      you.className = 'muted';
      you.textContent = ' (you)';
      tdEmail.appendChild(you);
    }

    const tdName = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.className = 'input input-name';
    nameInput.type = 'text';
    nameInput.value = user.name || '';
    tdName.appendChild(nameInput);

    const tdKey = document.createElement('td');
    const keyInput = document.createElement('input');
    keyInput.className = 'input input-key';
    keyInput.type = 'text';
    keyInput.maxLength = 10;
    keyInput.value = user.jira_key || '';
    tdKey.appendChild(keyInput);

    const tdRole = document.createElement('td');
    const roleSelect = document.createElement('select');
    roleSelect.className = 'select';
    for (const role of ['user', 'admin']) {
      const opt = document.createElement('option');
      opt.value = role;
      opt.textContent = role;
      if (user.role === role) opt.selected = true;
      roleSelect.appendChild(opt);
    }
    tdRole.appendChild(roleSelect);

    const tdActions = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-quiet';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        await apiJson('/api/admin/users/' + user.id, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value,
            jira_key: keyInput.value.trim().toUpperCase(),
            role: roleSelect.value
          })
        });
        saveBtn.textContent = 'Saved';
        setTimeout(() => { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 1200);
      } catch (err) {
        alert('Save failed: ' + err.message);
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
      }
    });
    actions.appendChild(saveBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-quiet danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Remove ' + user.email + '? Their uploads will stop working until re-added. To fully block sign-in, also remove them from the Access policy.')) return;
      deleteBtn.disabled = true;
      try {
        await apiJson('/api/admin/users/' + user.id, { method: 'DELETE', headers: { 'content-type': 'application/json' } });
        loadUsers();
      } catch (err) {
        alert('Delete failed: ' + err.message);
        deleteBtn.disabled = false;
      }
    });
    actions.appendChild(deleteBtn);

    tdActions.appendChild(actions);

    tr.appendChild(tdEmail);
    tr.appendChild(tdName);
    tr.appendChild(tdKey);
    tr.appendChild(tdRole);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  usersBody.innerHTML = '';
  usersBody.appendChild(table);
}

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  addMsg.hidden = true;
  addBtn.disabled = true;
  try {
    const payload = await apiJson('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('addEmail').value.trim(),
        name: document.getElementById('addName').value.trim(),
        jira_key: document.getElementById('addKey').value.trim().toUpperCase(),
        role: document.getElementById('addRole').value
      })
    });
    showAddMsg(payload.user.email + ' added. They can sign in with their work email right away.', 'ok');
    addForm.reset();
    loadUsers();
  } catch (err) {
    const msg = err.message === 'duplicate_email' ? 'That email is already mapped.' : err.message;
    showAddMsg('Could not add user: ' + msg, 'error');
  } finally {
    addBtn.disabled = false;
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.whoami.then(user => { me = user; loadUsers(); });
