// presentation/js/app.js

// ================= API Helper =================
async function apiFetch(url, method = 'GET', body, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers
  };

  // attach token if present
  const session = JSON.parse(sessionStorage.getItem('session') || 'null');
  if (session && session.token) headers['Authorization'] = `Bearer ${session.token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...opts
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API error');
  }
  return res.status === 204 ? null : res.json();
}

// ================= AUTH HANDLER =================
window.Auth = {
  // Login
  async login(role, username, password) {
    try {
      let url;
      if (role === 'parent') url = '/api/parents/login';
      else if (role === 'driver') url = '/api/drivers/login';
      else if (role === 'admin') url = '/api/admin/admins/login'; // 

      const resp = await apiFetch(url, 'POST', { username, password });

      const user = resp.user;
      if (!user) throw new Error('Invalid login response');

      // Store session
      sessionStorage.setItem(
        'session',
        JSON.stringify({ role, user, token: resp.token || null })
      );

      return { success: true, user };
    } catch (err) {
      return { success: false, message: err.message || err.toString() };
    }
  },

  // Logout
  logout() {
    sessionStorage.removeItem('session');
    location.href = '/html/login.html'; 
  },

  // Require role
  requireRole(role) {
    const raw = sessionStorage.getItem('session');
    if (!raw) {
      location.href = '/html/login.html';
      return null;
    }
    const s = JSON.parse(raw);
    if (role && s.role !== role) {
      location.href = '/html/login.html';
      return null;
    }
    return s;
  }
};

// ================= UI Helper =================
window.UI = {
  table(el, columns, rows) {
    const thead =
      '<tr>' + columns.map(c => `<th>${c.label}</th>`).join('') + '</tr>';
    const tbody = rows
      .map(
        r =>
          '<tr>' +
          columns
            .map(c => `<td>${c.render ? c.render(r[c.key], r) : (r[c.key] ?? '')}</td>`)
            .join('') +
          '</tr>'
      )
      .join('');
    el.innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
  }
};
