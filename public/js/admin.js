// public/js/admin.js
const session = Auth.requireRole('admin');

// Simple API helper that uses global apiFetch
async function api(url, method = 'GET', body) {
  return apiFetch(url, method, body);
}

/* ---------- UI navigation & tabs ---------- */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
document.querySelectorAll('.tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* ---------- Create form controls ---------- */
const roleSel = document.getElementById('c_role');
const adminFields = document.getElementById('adminFields');
const driverFields = document.getElementById('driverFields');
const parentFields = document.getElementById('parentFields');

function updateRoleFields() {
  const r = roleSel.value;
  adminFields.style.display = r === 'admin' ? 'block' : 'none';
  driverFields.style.display = r === 'driver' ? 'block' : 'none';
  parentFields.style.display = r === 'parent' ? 'block' : 'none';
}
roleSel.addEventListener('change', updateRoleFields);
updateRoleFields();

function addStudentField(defaultName = '', defaultId = '') {
  const container = document.getElementById('studentsList');
  const idx = container.children.length + 1;
  const div = document.createElement('div');
  div.className = "student-fields";
  div.innerHTML = `
    <input name="studentName" placeholder="Student name" value="${defaultName}" required />
    <input name="studentId" placeholder="Student ID" value="${defaultId}" required />
    <button type="button" class="btn xs" onclick="this.parentElement.remove()">Remove</button>
  `;
  container.appendChild(div);
}
window.addStudentField = addStudentField;

/* ---------- Form submit ---------- */
document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = document.getElementById('c_role').value;
  const name = document.getElementById('c_name').value.trim();
  const email = document.getElementById('c_email').value.trim();
  const password = document.getElementById('c_password').value;
  const phone = document.getElementById('c_phone').value.trim();

  try {
    if (role === 'admin') {
      const admin_id = document.getElementById('c_admin_id').value.trim();
      await api('/api/admin/admins', 'POST', { admin_id, name, email, password });
      alert('Admin created');
    } else if (role === 'driver') {
      const driver_id = document.getElementById('c_driver_id').value.trim();
      const license_number = document.getElementById('c_license').value.trim();
      const assigned_bus_id = document.getElementById('c_driver_bus').value.trim() || null;
      await api('/api/admin/drivers', 'POST', { driver_id, name, license_number, phone_number: phone, email, password, assigned_bus_id });
      alert('Driver created');
    } else if (role === 'parent') {
      const parent_id = document.getElementById('c_parent_id').value.trim();
      const children = [];
      document.querySelectorAll('#studentsList .student-fields').forEach(div => {
        const studentName = div.querySelector('input[name="studentName"]').value.trim();
        const studentId = div.querySelector('input[name="studentId"]').value.trim();
        if (studentName && studentId) children.push({ student_id: studentId, name: studentName });
      });
      if (children.length === 0) {
        alert('Please add at least one student for the parent.');
        return;
      }
      await api('/api/admin/parents', 'POST', { parent_id, name, phone_number: phone, email, password, children });
      alert('Parent created');
    } else {
      throw new Error('Unknown role');
    }

    // reset and refresh
    e.target.reset();
    document.getElementById('studentsList').innerHTML = '';
    updateRoleFields();
    renderTables();
  } catch (err) {
    alert('Error: ' + (err.message || err));
  }
});

/* ---------- Table rendering ---------- */
async function renderTables() {
  try {
    const accounts = await api('/api/admin/accounts');

    // 3️⃣ Separate by role
    const admins = accounts.filter(a => a.role === 'admin');
    const parents = accounts.filter(a => a.role === 'parent');
    const drivers = accounts.filter(a => a.role === 'driver');

    const act = (u) => `<div class="row-actions">
      <button class="btn xs" onclick="resetPw(${JSON.stringify(u.role)}, ${JSON.stringify(u.email)})">Reset PW</button>
      <button class="btn xs danger" onclick="delUser(${JSON.stringify(u.role)}, ${JSON.stringify(u.email)})">Delete</button>
    </div>`;

    // Render tables
    UI.table(document.getElementById('adminsTable'),
      [{ key: 'email', label: 'Email' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'actions', label: 'Actions', render: (_, u) => act(u) }],
      admins.map(u => ({ ...u, actions: '' }))
    );

    UI.table(document.getElementById('parentsTable'),
      [{ key: 'email', label: 'Email' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'busId', label: 'Bus' },
       { key: 'students', label: 'Students', render: (_, u) => (u.students || []).map(s => `${s.name} (${s.student_id})`).join('<br>') },
       { key: 'actions', label: 'Actions', render: (_, u) => act(u) }],
      parents.map(u => ({ ...u, actions: '' }))
    );

    UI.table(document.getElementById('driversTable'),
      [{ key: 'email', label: 'Email' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'busId', label: 'Bus' }, { key: 'actions', label: 'Actions', render: (_, u) => act(u) }],
      drivers.map(u => ({ ...u, actions: '' }))
    );

  } catch (err) {
    console.error(err);
    alert('Failed to load accounts: ' + (err.message || err));
  }
}


window.resetPw = async function (role, email) {
  try {
    const pw = prompt('Enter new password for ' + email + ':');
    if (!pw) return;
    await api(`/api/admin/accounts/${role}/${encodeURIComponent(email)}/password`, 'PUT', { password: pw });
    alert('Password updated');
    renderTables();
  } catch (err) {
    alert('Error: ' + (err.message || err));
  }
};

window.delUser = async function (role, email) {
  if (!confirm(`Delete ${email} (${role})?`)) return;
  try {
    await api(`/api/admin/accounts/${role}/${encodeURIComponent(email)}`, 'DELETE');
    alert('Deleted');
    renderTables();
  } catch (err) {
    alert('Error: ' + (err.message || err));
  }
};

/* initial load */
renderTables();

/* ---------- Live Map (same as parent) ---------- */
mapboxgl.accessToken = 'pk.eyJ1IjoiaGFsYWhwc3UiLCJhIjoiY21mYTVyMDc3MWduODJpcGZibXo4Zm4ydCJ9.39r6v4E1LpxdLGQm1Y_Gfg'; // use your token
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [46.6753, 24.7136],
  zoom: 12
});
map.addControl(new mapboxgl.NavigationControl());

let busMarker = null;
const socket = io();

socket.on('location', (data) => {
  const { lat, lng } = data;
  if (!busMarker) {
    const el = document.createElement('div');
    el.style.backgroundImage = 'url("images/bus.png")';
    el.style.backgroundSize = 'cover';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.cursor = 'pointer';
    busMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
  } else {
    busMarker.setLngLat([lng, lat]);
  }
  map.flyTo({ center: [lng, lat], zoom: 14 });
});
