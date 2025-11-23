// presentation/js/admin.js
const session = Auth.requireRole('admin');
const stored = JSON.parse(sessionStorage.getItem('session') || 'null');
const me = stored?.user || null;


// Simple API helper that uses global apiFetch
async function api(url, method = 'GET', body) {
  return apiFetch(url, method, body);
}

/* ---------- UI navigation & tabs ---------- */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
   // Load student QR cards when opening that section
   if (id === 'qrCardsSection') {
    loadStudentQrCards();
  }
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

  // Show/hide fields based on role
  adminFields.style.display = r === 'admin' ? 'block' : 'none';
  driverFields.style.display = r === 'driver' ? 'block' : 'none';
  parentFields.style.display = r === 'parent' ? 'block' : 'none';

  // Toggle required attributes based on role
  document.getElementById('c_admin_id').required = r === 'admin';
  document.getElementById('c_driver_id').required = r === 'driver';
  document.getElementById('c_license').required = r === 'driver';
  document.getElementById('c_parent_id').required = r === 'parent';

  //  Load unassigned buses if Driver is selected
  if (r === 'driver') {
    loadUnassignedBuses();
  }
}

// Attach listener
roleSel.addEventListener('change', updateRoleFields);
updateRoleFields();

/* ---------- Bus ID generation ---------- */
async function generateBusId() {
  try {
    const res = await api('/api/buses/generate-bus-id');
    document.getElementById('bus_id').value = res.bus_id;
  } catch (err) {
    console.error('Failed to generate bus ID', err);
    document.getElementById('bus_id').value = '';
  }
}

// Generate bus ID on page load
generateBusId();

/* ---------- Load Unassigned Buses for Driver Dropdown ---------- */
async function loadUnassignedBuses() {
  try {
    const res = await api("/api/buses/buses/unassigned"); 
    const select = document.getElementById("c_driver_bus");


    select.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());

    res.forEach(bus => {
      const option = document.createElement("option");
      option.value = bus._id;  
      option.textContent = `${bus.bus_id} (${bus.plate_number}, Cap: ${bus.capacity})`; 
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load unassigned buses:", err);
  }
}

const plateInput = document.getElementById('plate_number');

// Auto-insert dash
plateInput.addEventListener('input', () => {
  let value = plateInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (value.length > 3) {
    value = value.slice(0,3) + '-' + value.slice(3,7);
  }
  plateInput.value = value;
});

/* ---------- Bus Form Submit ---------- */
document.getElementById('busForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const bus_id = document.getElementById('bus_id').value.trim();
  const plate_number = plateInput.value.trim();
  const capacity = parseInt(document.getElementById('capacity').value);

  if (!bus_id || !plate_number || !capacity) {
    showError('Please fill all fields');
    return;
  }

  // Validate plate number
  const platePattern = /^[A-Z]{3}-[0-9]{4}$/;
  if (!platePattern.test(plate_number)) {
    showError('Invalid plate number. Plate number must be 3 letters followed by 4 numbers');
    return;
  }

  try {
    await api('/api/buses/buses', 'POST', { bus_id, plate_number, capacity });
    showSuccess('Bus added successfully');
    document.getElementById('busForm').reset();
    generateBusId();  
    renderBuses();   
  } catch (err) {
    showError(parseError(err));
  }
});

//  Removed duplicate toggle code here (it only exists inside updateRoleFields now)
async function addStudentField(defaultName = '', defaultId = '') {
  const container = document.getElementById('studentsList');

  // if no ID provided, fetch one from backend
  if (!defaultId) {
    try {
      const res = await api('/api/admin/generate-student-id');
      defaultId = res.student_id; // STU12345
    } catch (err) {
      console.error('Failed to get student ID', err);
      defaultId = '';
    }
  }

  const div = document.createElement('div');
  div.className = "student-fields";
  div.innerHTML = `
    <input 
      name="studentName" 
      placeholder="Student name" 
      value="${defaultName}" 
      required 
      pattern="[A-Za-z ]{1,30}" 
      title="Name can only contain letters and spaces, maximum 30 characters"
    />
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
      const username = "a." + admin_id.replace(/^a\./,'');
      await api('/api/admin/admins', 'POST', { admin_id, name, email, phone_number: phone, password, username });
      showSuccess('Admin created');
    } else if (role === 'driver') {
      const driver_id = document.getElementById('c_driver_id').value.trim();
      const license_number = document.getElementById('c_license').value.trim();
      const busSelect = document.getElementById('c_driver_bus').value;

      const assigned_bus_id = busSelect && busSelect !== "" ? busSelect : null;

      const username = "d." + driver_id.replace(/^d\./, '');
      console.log("Dropdown raw value:", document.getElementById("c_driver_bus").value);
      console.log("Final assigned_bus_id sent:", assigned_bus_id);

      await api('/api/admin/drivers', 'POST', { 
        driver_id,  
        name, 
        license_number, 
        phone_number: phone, 
        email, 
        password,  
        assigned_bus_id,  
        username 
      });
      showSuccess('Driver created');
      renderTables();   
      renderBuses();    
    } else if (role === 'parent') {
      const parent_id = document.getElementById('c_parent_id').value.trim();
      const username = "p." + parent_id.replace(/^p\./,'');
      const home_address = document.getElementById('c_parent_address').value.trim();

      const children = [];
      document.querySelectorAll('#studentsList .student-fields').forEach(div => {
        const studentName = div.querySelector('input[name="studentName"]').value.trim();
        if (studentName) children.push({ name: studentName }); 
      });

      if (children.length === 0) { 
        showError('Please add at least one student'); 
        return; 
      }

      await api('/api/admin/parents', 'POST', { parent_id, name, phone_number: phone, email, password, username, home_address, children });
      showSuccess('Parent created');
    }

    e.target.reset();
    document.getElementById('studentsList').innerHTML = '';
    updateRoleFields();
    renderTables();
  } catch (err) {
    console.error('Form submit error:', err);
    showError(parseError(err));
  }
});


/* ---------- Table rendering ---------- */
async function renderTables() {
  try {
    const accounts = await api('/api/admin/accounts');

    const admins = accounts.filter(a => a.role === 'admin');
    const parents = accounts.filter(a => a.role === 'parent');
    const drivers = accounts.filter(a => a.role === 'driver');

    const act = (u) => {
      let buttons = `
        <button class="btn xs" onclick="resetPw('${u.role}', '${u.email}')">Reset PW</button>
        <button class="btn xs danger" onclick="delUser('${u.role}', '${u.email}')">Delete</button>
      `;
      // --- Manage Children Feature ---
      if (u.role === 'parent') {
        buttons += `<button class="btn xs" onclick="manageChildren('${u._id}', '${u.name}')">Manage Children</button>`;
      }
      return `<div class="row-actions">${buttons}</div>`;
    };

    UI.table(document.getElementById('adminsTable'),
      [{ key: 'email', label: 'Email' }, 
      { key: 'name', label: 'Name' },
      { key: 'username', label: 'Username' },
      { key: 'phone', label: 'Phone' }, 
      { key: 'actions', label: 'Actions', render: (_, u) => act(u) }],
      admins.map(u => ({ ...u, actions: '' }))
    );

    UI.table(document.getElementById('parentsTable'),
      [
        { key: 'email', label: 'Email' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'username', label: 'Username' },
        { key: 'students', label: 'Students', render: (_, u) => (u.students || []).map(s => `${s.name} – ${s.bus_id || " "}`).join('<br>') },
        { key: 'actions', label: 'Actions', render: (_, u) => act(u) }
      ],
      parents.map(u => ({ ...u, actions: '' }))
    );

    UI.table(document.getElementById('driversTable'),
      [
        { key: 'email', label: 'Email' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'username', label: 'Username' }, 

        { 
          key: "bus_id",
          label: "Bus Assigned",
          render: (val) => val || "—"
        },

        { key: 'actions', label: 'Actions', render: (_, u) => act(u) }
      ],

      drivers.map(d => ({
        ...d,
        bus_id: d.bus?.bus_id || null, 
        actions: ''
      }))
    );

  } catch (err) {
    console.error(err);
    showError(parseError(err));
  }
}

window.resetPw = async function (role, email) {
  showResetPassword(email, async (newPw) => {
    try {
      await api(`/api/admin/accounts/${role}/${encodeURIComponent(email)}/password`, 'PUT', { newPassword: newPw });
      showSuccess('Password updated');
      renderTables();
    } catch (err) {
      showError(parseError(err));
    }
  });
};

window.delUser = async function (role, email) {
  showConfirm(`Delete ${email} (${role})?`, async () => {
    try {
      await api(`/api/admin/accounts/${role}/${encodeURIComponent(email)}`, 'DELETE');
      showSuccess('Deleted');
      renderTables();
    } catch (err) {
      showError(parseError(err));
    }
  });
};

/* ---------- Manage Children Feature ---------- */
window.manageChildren = async function (parentId, parentName) {
  const modal = document.getElementById('childrenModal');
  const closeBtn = document.getElementById('childrenClose');
  const listEl = document.getElementById('childrenList');
  const nameEl = document.getElementById('parentName');
  const addBtn = document.getElementById('addChildBtn');
  const childNameInput = document.getElementById('childName');

  nameEl.textContent = parentName;
  modal.classList.remove('hidden');
  modal.dataset.parentId = parentId;

  async function loadChildren() {
    try {
      const parent = await api(`/api/admin/parents/${parentId}`, 'GET');
      listEl.innerHTML = parent.children.map(c => `
        <li>
          ${c.name} (ID: ${c.student_id})
          <button class="btn xs danger" onclick="removeChildFromParent('${parentId}', '${c.student_id}')">Remove</button>
        </li>
      `).join('') || '<li>No children yet</li>';
    } catch (err) {
      console.error(err);
      listEl.innerHTML = '<li>Error loading children</li>';
    }
  }

  // Initial load
  await loadChildren();

  // Close modal
  closeBtn.onclick = () => modal.classList.add('hidden');

  // Add child
  addBtn.onclick = async () => {
    const childName = childNameInput.value.trim();
    if (!childName) {
      showError('Enter child name');
      return;
    }
    try {
      
      const res = await api('/api/admin/generate-student-id');
      const studentId = res.student_id;

      await api(`/api/admin/parents/${parentId}/children`, 'POST', { name: childName, student_id: studentId });
      showSuccess('Child added');
      childNameInput.value = '';
      await loadChildren(); 
      renderTables();       
    } catch (err) {
      showError(parseError(err));
    }
  };


  window._reloadChildren = loadChildren;
};

window.removeChildFromParent = async function (parentId, childId) {
  try {
    await api(`/api/admin/parents/${parentId}/children/${childId}`, 'DELETE');
    showSuccess('Child removed');
    if (window._reloadChildren) await window._reloadChildren(); 
    renderTables(); 
  } catch (err) {
    showError(parseError(err));
  }
};

/* initial load */
renderTables();

/* ---------- Load Unassigned Drivers ---------- */
async function loadUnassignedDrivers() {
  try {
    const res = await api("/api/buses/drivers/unassigned");
    return res;
  } catch (err) {
    console.error("Failed to load unassigned drivers:", err);
    return [];
  }
}

// ---------- Render Buses ----------
async function renderBuses() {
  try {
    const res = await api('/api/buses/get-buses');
    const tableBody = document.querySelector('#busTable tbody');
    tableBody.innerHTML = '';

    res.forEach(bus => {
      const row = document.createElement('tr');
      let actionHTML = '';

      // If bus has driver → show "Remove Driver" button
      if (bus.driver) {
        actionHTML = `
          <button class="btn xs" onclick="unassignDriver('${bus.bus_id}')">Remove Driver</button>
        `;
      } 
      // If bus has no driver → show the new "Assign Driver" modal button
      else {
        actionHTML = `
          <button class="btn xs" onclick="openAssignDriverModal('${bus.bus_id}')">Assign Driver</button>
        `;
      }

      // Add Delete button to all rows
      actionHTML += `
        <button class="btn xs danger" onclick="deleteBus('${bus.bus_id}')">Delete</button>
      `;

      row.innerHTML = `
        <td>${bus.bus_id}</td>
        <td>${bus.plate_number}</td>
        <td>${bus.capacity}</td>
        <td>${bus.driver ? bus.driver.name : 'Unassigned'}</td>
        <td>${actionHTML}</td>
      `;

      tableBody.appendChild(row);
    });

    // Refresh driver dropdown in Create Driver form
    await loadUnassignedBuses();
  } catch (err) {
    console.error('Failed to render buses:', err);
  }
}

// Call it once on page load
renderBuses();

/* ---------- Delete Bus ---------- */
async function deleteBus(bus_id) {
  showConfirm(`Delete bus ${bus_id}?`, async () => {
    try {
      await api(`/api/buses/buses/${bus_id}`, 'DELETE');
      showSuccess('Bus deleted');
      renderBuses();
    } catch (err) {
      showError(parseError(err));
    }
  });
}
window.deleteBus = deleteBus;


renderBuses();

/* ---------- Unassign Driver from Bus ---------- */
async function unassignDriver(bus_id) {
  showConfirm(`Remove driver from bus ${bus_id}?`, async () => {
    try {
      await api(`/api/buses/buses/${bus_id}/unassign-driver`, 'PUT');
      showSuccess('Driver unassigned successfully');
      await renderBuses();        
      await loadUnassignedBuses();
    } catch (err) {
      console.error('Unassign error:', err);
      showError(parseError(err));
    }
  });
}
window.unassignDriver = unassignDriver;

/* ---------- Assign Driver Modal ---------- */
async function openAssignDriverModal(bus_id) {
  try {
    const drivers = await loadUnassignedDrivers();
    if (!drivers.length) {
      showError("No unassigned drivers available");
      return;
    }

    // Create dropdown HTML
    const selectHtml = `
      <label style="display:block; margin-bottom:12px;">
        <span style="display:block; margin-bottom:6px; font-weight:500;">Select Driver:</span>
        <select id="assignDriverSelect" class="small-dropdown" style="width:100%;">
          <option value="">Select a driver</option>
          ${drivers.map(d => `<option value="${d._id}">${d.name} (${d.driver_id})</option>`).join('')}
        </select>
      </label>
    `;

    // Use your existing confirm box
    showConfirmBoxWithSelect(
      `Assign driver to bus ${bus_id}`,
      selectHtml,
      async () => {
        const selectedId = document.getElementById("assignDriverSelect").value;
        if (!selectedId) {
          showError("Please select a driver first");
          return;
        }
        await api(`/api/buses/buses/${bus_id}/assign-driver`, "POST", { driverId: selectedId });
        showSuccess("Driver assigned successfully");
        await renderBuses();
      }
    );
  } catch (err) {
    console.error("openAssignDriverModal error:", err);
    showError("Failed to load drivers");
  }
}


/* ---------- Assign Driver To Bus ---------- */
async function assignDriverToBus(bus_id) {
  const select = document.getElementById(`assignDriver-${bus_id}`);
  const driverId = select.value;

  if (!driverId) {
    showError("Please select a driver first");
    return;
  }

  try {
    await api(`/api/buses/buses/${bus_id}/assign-driver`, "POST", { driverId });
    showSuccess("Driver assigned successfully");
    await renderBuses();       
    await loadUnassignedBuses(); 
  } catch (err) {
    console.error("Assign driver error:", err);
    showError(parseError(err));
  }
}
window.assignDriverToBus = assignDriverToBus;


/* ---------- Live Map (Supports Multiple Buses) ---------- */
mapboxgl.accessToken = 'pk.eyJ1IjoiaGFsYWhwc3UiLCJhIjoiY21mYTVyMDc3MWduODJpcGZibXo4Zm4ydCJ9.39r6v4E1LpxdLGQm1Y_Gfg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [46.6753, 24.7136],
  zoom: 12
});
map.addControl(new mapboxgl.NavigationControl());

// Store ALL bus markers here
let busMarkers = {};

const socket = io();

// 1) Load all buses once on page load 
async function loadExistingBusMarkers() {
  try {
    const buses = await api('/api/buses/locations/all');
    buses.forEach(b => {
      if (!b.last_lat || !b.last_lng) return;

      const el = document.createElement('div');
      el.style.backgroundImage = 'url("/images/bus.png")';
      el.style.backgroundSize = 'cover';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.cursor = 'pointer';

      busMarkers[b.bus_id] = new mapboxgl.Marker(el)
        .setLngLat([b.last_lng, b.last_lat])
        .addTo(map);
    });
  } catch (err) {
    console.error("Failed to load initial bus markers:", err);
  }
}

// Call it on load
loadExistingBusMarkers();

// 2) Real-time updates for ALL buses 
socket.on('location', (data) => {
  const { bus_id, lat, lng } = data;
  if (!bus_id) return;

  if (!busMarkers[bus_id]) {
    const el = document.createElement('div');
    el.style.backgroundImage = 'url("/images/bus.png")';
    el.style.backgroundSize = 'cover';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.cursor = 'pointer';

    busMarkers[bus_id] = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .addTo(map);

  } else {
    busMarkers[bus_id].setLngLat([lng, lat]);
  }

  map.flyTo({ center: [lng, lat], zoom: 14 });
});

/* ---------- Custom Confirm and Reset Password Modals ---------- */
function showConfirm(message, onYes, onNo) {
  const box = document.getElementById('confirmBox');
  const msg = document.getElementById('confirmMessage');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn = document.getElementById('confirmNo');

  msg.textContent = message;
  box.classList.add('show');

  yesBtn.onclick = () => {
    box.classList.remove('show');
    if (onYes) onYes();
  };
  noBtn.onclick = () => {
    box.classList.remove('show');
    if (onNo) onNo();
  };
}

function showResetPassword(email, onSubmit) {
  const box = document.getElementById('resetBox');
  const input = document.getElementById('resetInput');
  const okBtn = document.getElementById('resetOk');
  const cancelBtn = document.getElementById('resetCancel');

  document.getElementById('resetMessage').textContent = `Enter new password for ${email}:`;
  input.value = '';
  box.classList.add('show');
  input.focus();

  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  input.title = "At least 8 characters, uppercase, lowercase, numbers, and a special character";

  okBtn.onclick = () => {
    const newPw = input.value.trim();
    if (!newPw) {
      showError('Password cannot be empty');
      return;
    }
    if (!pattern.test(newPw)) {
      showError('At least 8 characters, uppercase, lowercase, numbers, and a special character');
      return;
    }
    box.classList.remove('show');
    if (onSubmit) onSubmit(newPw);
  };

  cancelBtn.onclick = () => {
    box.classList.remove('show');
  };
}

/* ----------  Confirm Box with Dropdown (for Assign Driver) ---------- */
async function showConfirmBoxWithSelect(bus_id, options, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-box show';

  overlay.innerHTML = `
    <div class="confirm-content">
      <p><strong>Assign Driver to Bus ${bus_id}</strong></p>
      <select id="confirmDriverSelect" class="small-dropdown" style="width:100%;margin-bottom:10px;">
        <option value="">Select driver</option>
        ${options.map(o => `<option value="${o._id}">${o.name} (${o.driver_id})</option>`).join('')}
      </select>
      <div class="confirm-actions">
        <button class="btn yes">Assign</button>
        <button class="btn no">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const select = overlay.querySelector('#confirmDriverSelect');
  const yesBtn = overlay.querySelector('.btn.yes');
  const noBtn = overlay.querySelector('.btn.no');

  yesBtn.onclick = () => {
    const selectedId = select.value;
    if (!selectedId) {
      showError("Please select a driver first");
      return;
    }
    overlay.remove();
    onConfirm(selectedId);
  };

  noBtn.onclick = () => overlay.remove();
}

/* ---------- Open Assign Driver Modal ---------- */
async function openAssignDriverModal(bus_id) {
  try {
    const unassignedDrivers = await loadUnassignedDrivers();
    if (!unassignedDrivers.length) {
      showError("No unassigned drivers available");
      return;
    }
    showConfirmBoxWithSelect(bus_id, unassignedDrivers, async (driverId) => {
      try {
        await api(`/api/buses/buses/${bus_id}/assign-driver`, 'POST', { driverId });
        showSuccess("Driver assigned successfully");
        await renderBuses();
        await loadUnassignedBuses();
      } catch (err) {
        console.error("Assign driver error:", err);
        showError(parseError(err));
      }
    });
  } catch (err) {
    console.error("Failed to open assign driver modal:", err);
    showError("Failed to load drivers");
  }
}


// === Load Unassigned Students ===
async function loadUnassignedStudents() {
  try {
    // Get unassigned students directly from the updated backend
    const unassigned = await api("/api/buses/get-students");

    const studentsList = document.getElementById("students-list");
    studentsList.innerHTML = unassigned.map(s =>
      `<label>
        <input type="checkbox" value="${s.student_id}">
        ${s.student_id} - ${s.name}
      </label>`
    ).join("<br>");

  } catch (err) {
    console.error("Failed to load unassigned students:", err);
  }
}



// === Load Buses ===
// === Load Available Buses ===
async function loadBuses() {
  try {
    
    const buses = await api("/api/buses/available-buses");

    const select = document.getElementById("bus-select");
    select.innerHTML = ""; 
    if (!buses.length) {
      const opt = document.createElement("option");
      opt.textContent = "No available buses";
      opt.disabled = true;
      select.appendChild(opt);
      return;
    }

    buses.forEach(bus => {
      const opt = document.createElement("option");
      opt.value = bus.bus_id;
      opt.textContent = `${bus.bus_id} - ${bus.driver} (${bus.assignedCount}/${bus.capacity})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load available buses:", err);
  }
}


// Call loadBuses when opening assign section
document.querySelector('[onclick="showSection(\'assignSection\')"]')
  .addEventListener("click", loadAssignStudentsTab);


// === Load tab ===
async function loadAssignStudentsTab() {
  try {
    await loadBuses();
    await loadUnassignedStudents();
  } catch (err) {
    console.error("Error loading assign tab", err);
    showMessage("Error loading buses/students", "error");
  }
}

// === Assign Students to Bus ===
async function assignStudents() {
  const bus_id = document.getElementById("bus-select").value;
  const student_ids = Array.from(
    document.querySelectorAll("#students-list input:checked")
  ).map(i => i.value);

  if (!bus_id || student_ids.length === 0) {
    showError("Select at least one student");
    return;
  }

  try {
    const res = await api("/api/buses/assign-students-bus", "POST", { bus_id, student_ids });
    showSuccess(res.message || "Assigned successfully");

    await new Promise(res => setTimeout(res, 200));
    await loadAssignStudentsTab();
  } catch (err) {
    console.error("Assign error:", err);
    showError("Failed to assign students");
  }
}

document.querySelector('[data-target="assign-students-section"]')
  ?.addEventListener("click", loadAssignStudentsTab);

document.getElementById("assignBtn")
  ?.addEventListener("click", assignStudents);

// ================== NOTIFICATIONS ==================
const notifBell = document.getElementById("notifBell");
const notifDropdown = document.getElementById("notifDropdown");
const notifCount = document.getElementById("notifCount");

let notifications = [];

const adminId = me?._id ? String(me._id) : (me?.admin_id ? String(me.admin_id) : null);

if (!adminId) {
  showError("No adminId found in session — notifications will not work");
}

// Fetch notifications for admin
async function loadNotifications() {
  if (!adminId) return;

  try {
    const res = await api(`/api/notifications/admin/${me._id}`);
    const oldCount = notifications.length;

    //Filter out notifications that are 'read' and older than 5 days
    const now = new Date();
    notifications = (res || []).filter(n => {
      const receiver = n.receivers.find(
        r => String(r.receiver_id) === String(adminId) &&
             r.receiver_role === "admin"
      );
      const isRead = receiver?.status === "read";
      const sentAt = new Date(n.sent_at);
      const diffDays = (now - sentAt) / (1000 * 60 * 60 * 24);
      return !(isRead && diffDays > 5); // Remove old read ones
    });

    renderNotifications();

    if (notifications.length > oldCount) {
      const latest = notifications[0];
      if (latest?.notification?.message) {
        showToast(
          `🚨 ${latest.notification.type?.toUpperCase() || "ALERT"}: ${latest.notification.message}`
        );
      }
    }
  } catch (err) {
    showError("Failed to load admin notifications");
  }
}


// Render notifications in dropdown
function renderNotifications() {
  // Count unread for this admin
  notifCount.textContent = notifications.filter(n =>
    n.receivers.some(
      r => String(r.receiver_id) === String(adminId) &&
           r.receiver_role === "admin" &&
           r.status === "unread"
    )
  ).length;

  // Build dropdown items
  notifDropdown.innerHTML =
    notifications.map(n => {
      const note = n.notification || {};
      const receiver = n.receivers.find(
        r => String(r.receiver_id) === String(adminId) &&
             r.receiver_role === "admin"
      );
      const cls = receiver?.status === "unread" ? "notif-item unread" : "notif-item";

      return `<div class="${cls}" onclick="markRead('${n.sent_id}')">
        <strong>${note.type?.toUpperCase() || "ALERT"}</strong>: ${note.message}<br>
        <small>${new Date(n.sent_at).toLocaleString()}</small>
      </div>`;
    }).join("") || "<div class='notif-item'>No notifications</div>";
}

// Mark as read
async function markRead(sentId) {
  if (!adminId) return;
  try {
    await api(`/api/notifications/mark-read/${sentId}/${adminId}`, "PUT");
    await loadNotifications();
    showSuccess("Notification marked as read");
  } catch (err) {
    showError("Failed to mark notification as read");
  }
}

// Toggle dropdown
notifBell.addEventListener("click", () =>
  notifDropdown.classList.toggle("hidden")
);

// Auto-refresh notifications
setInterval(loadNotifications, 10000);
loadNotifications();

// Close dropdown if clicking outside
document.addEventListener("click", (e) => {
  if (!notifBell.contains(e.target) && !notifDropdown.contains(e.target)) {
    notifDropdown.classList.add("hidden");
  }


});

// FETCH AND DISPLAY STUDENT QR CARDS

async function loadStudentQrCards() {
  try {
    const res = await fetch("/api/admin/get-all-students");
    const students = await res.json();

    const container = document.getElementById("qrCardsContainer");
    container.innerHTML = "";

    if (!students.length) {
      container.innerHTML = "<p>No students found.</p>";
      return;
    }

    students.forEach(s => {
      const card = document.createElement("div");
      card.className = "qr-card";
      card.innerHTML = `
        <h3>${s.name}</h3>
        <p><strong>ID:</strong> ${s.student_id}</p>
        ${
          s.card_url
            ? `
              <img src="${s.card_url}" alt="QR Card" class="qr-img" />
              <div class="qr-actions">
                <button class="btn small" onclick="downloadQrCard('${s.card_url}', '${s.name}')">Download</button>
                <button class="btn small" onclick="printQrCard('${s.card_url}', '${s.name}')">Print</button>
              </div>
            `
            : `<p style="color:red;">No QR card generated</p>`
        }
      `;
      container.appendChild(card);
    });
    
  } catch (err) {
    console.error("Error loading QR cards:", err);
  }
}

// DOWNLOAD + PRINT FUNCTIONS

function downloadQrCard(url, name) {
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}_QRCard.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printQrCard(url, name) {
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html><head><title>${name} QR Card</title></head>
    <body style="text-align:center;">
      <img src="${url}" style="width:400px;" />
      <script>window.onload=()=>{window.print();window.close();}</script>
    </body></html>
  `);
  printWindow.document.close();
}

// BUS ATTENDANCE LOGS
let currentPage = 1;
const limit = 20; // 20 records per page

// Fetch and render attendance logs
async function loadAttendanceLogs(page = 1) {
  const tableBody = document.querySelector("#attendanceTable tbody");
  const searchInput = document.getElementById("searchAttendance");
  const paginationDiv = document.getElementById("attendancePagination");

  try {
    const res = await api(`/api/admin/attendance-logs?page=${page}&limit=${limit}`);
    const logs = res.data || [];

    // Render table rows
    renderAttendanceTable(logs);

    // Pagination controls
    const { total, pages } = res.pagination;
    paginationDiv.innerHTML = `
      <button ${page <= 1 ? "disabled" : ""} onclick="loadAttendanceLogs(${page - 1})">⬅ Prev</button>
      <span>Page ${page} of ${pages}</span>
      <button ${page >= pages ? "disabled" : ""} onclick="loadAttendanceLogs(${page + 1})">Next ➡</button>
    `;

    // Attach live search filter
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      const filtered = logs.filter(log =>
        (log.student_ref?.student_id?.toLowerCase().includes(q)) ||
        (log.bus_ref?.bus_id?.toLowerCase().includes(q)) ||
        (log.status?.toLowerCase().includes(q))
      );
      renderAttendanceTable(filtered);
    });

  } catch (err) {
    console.error("Error loading attendance logs:", err);
    showError("Failed to load attendance logs");
    tableBody.innerHTML = "<tr><td colspan='7'>Error loading data</td></tr>";
  }
}

// Render attendance logs table
function renderAttendanceTable(logs) {
  const tableBody = document.querySelector("#attendanceTable tbody");
  if (!logs.length) {
    tableBody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No attendance records found</td></tr>";
    return;
  }

  tableBody.innerHTML = logs
    .map(log => `
      <tr>
        <td>${log.student_ref?.student_id || "—"}</td>
        <td>${log.student_ref?.name || "—"}</td>
        <td>${log.bus_ref?.bus_id || "—"}</td>
        <td>${log.bus_ref?.plate_number || "—"}</td>
        <td class="status-${log.status?.toLowerCase().replace(/\s/g, '_')}">
          ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
        </td>
        <td>${new Date(log.scan_time).toLocaleString()}</td>
      </tr>
    `)
    .join("");
}


// When the admin clicks the sidebar button → show section + load data
document.querySelector('[onclick="showSection(\'attendanceSection\')"]').addEventListener("click", async () => {
  showSection("attendanceSection");
  await loadAttendanceLogs();
});

