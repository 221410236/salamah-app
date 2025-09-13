// public/js/app.js

// API helper
async function apiFetch(url, method = 'GET', body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // attach token if present
  const session = JSON.parse(sessionStorage.getItem('session') || 'null');
  if (session && session.token) headers['Authorization'] = `Bearer ${session.token}`;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, ...opts });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API error');
  }
  return res.status === 204 ? null : res.json();
}

window.Auth = {
  // login accepts username and password
  async login(role, username, password) {
    try {
      let url;
      if (role === 'parent') url = '/api/parents/login';
      else if (role === 'driver') url = '/api/drivers/login';
      else if (role === 'admin') url = '/api/admin/admins/login';
      else throw new Error('Invalid role');

      const resp = await apiFetch(url, 'POST', { username, password });

      // server returns { parent } or { driver } or { admin }
      let user;
      if (resp.parent) user = resp.parent;
      else if (resp.driver) user = resp.driver;
      else if (resp.admin) user = resp.admin;
      else user = resp.user || null;

      if (!user) {
        // fallback to minimal id returned
        if (resp.parent_id || resp.driver_id || resp.admin_id) {
          user = { username };
        } else {
          throw new Error('Invalid login response');
        }
      }

      // store session (no token now, but structure allows token in future)
      sessionStorage.setItem(
        'session',
        JSON.stringify({ role, username, user, token: resp.token || null })
      );
      return { success: true, user };
    } catch (err) {
      return { success: false, message: err.message || err.toString() };
    }
  },

  logout() {
    sessionStorage.removeItem('session');
    location.href = '/';
  },

  requireRole(role) {
    const raw = sessionStorage.getItem('session');
    if (!raw) {
      location.href = '/';
      return null;
    }
    const s = JSON.parse(raw);
    if (role && s.role !== role) {
      location.href = '/';
      return null;
    }
    return s;
  }
};

// small UI helpers used in admin.js etc.
window.UI = {
  table(el, columns, rows) {
    const thead =
      '<tr>' +
      columns.map(c => `<th>${c.label}</th>`).join('') +
      '</tr>';
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
