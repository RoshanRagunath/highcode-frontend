// Fetches the current user once and fills the nav strip on every signed-in page.
// Exposes window.whoami (a promise) for page scripts that need the user too.

window.whoami = (async () => {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      // Access session expired: the fetch got the login page. Reload so
      // Access can re-prompt.
      location.reload();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
})();

window.whoami.then(user => {
  const slot = document.getElementById('navUser');
  if (!slot || !user) return;

  const frag = document.createDocumentFragment();

  if (user.jira_key) {
    const key = document.createElement('span');
    key.className = 'user-key';
    key.textContent = user.jira_key;
    key.title = 'Your Jira project';
    frag.appendChild(key);
  }

  const email = document.createElement('span');
  email.className = 'user-email';
  email.textContent = user.email;
  frag.appendChild(email);

  const here = location.pathname;

  if (user.role === 'admin' && !here.startsWith('/admin')) {
    const admin = document.createElement('a');
    admin.className = 'user-link';
    admin.href = '/admin/';
    admin.textContent = 'Admin';
    frag.appendChild(admin);
  }

  if (!here.startsWith('/account')) {
    const account = document.createElement('a');
    account.className = 'user-link';
    account.href = '/account/';
    account.textContent = 'Account';
    frag.appendChild(account);
  }

  const logout = document.createElement('a');
  logout.className = 'user-link';
  logout.href = '/cdn-cgi/access/logout';
  logout.textContent = 'Logout';
  frag.appendChild(logout);

  slot.appendChild(frag);
});
