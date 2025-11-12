// presentation/js/parent.js (FINAL UPDATED VERSION)

const session = Auth.requireRole('parent');
const stored = JSON.parse(sessionStorage.getItem('session') || 'null');
const me = stored?.user || null;

// CHILD DETAILS SECTION
const detailsEl = document.getElementById('childDetails');

if (!me || !me.children || me.children.length === 0) {
  detailsEl.innerHTML = 'No child details available';
} else {
  let html = `<div class="key">Parent</div><div>${me.username}</div>`;
  me.children.forEach((student, index) => {
    const bus = student.assigned_bus_id || null;
    const driver = bus?.driver_id || null;

    html += `
      <div class="child-box" style="margin-top:15px; border-top:1px solid #ddd; padding-top:10px;">
        <div class="key">Student ${index + 1}</div><div>${student.name} (${student.student_id})</div>
        <div class="key">Bus</div><div>${bus ? bus.plate_number : 'No bus assigned yet'}</div>
        <div class="key">Driver</div><div>${driver ? driver.username : 'No driver assigned yet'}</div>
        <div class="key">Driver Phone</div><div>${driver ? driver.phone_number || '-' : '-'}</div>
      </div>
    `;
  });
  detailsEl.innerHTML = html;
}

// MAPBOX SETUP
mapboxgl.accessToken = 'pk.eyJ1IjoiaGFsYWhwc3UiLCJhIjoiY21mYTVyMDc3MWduODJpcGZibXo4Zm4ydCJ9.39r6v4E1LpxdLGQm1Y_Gfg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [46.6753, 24.7136],
  zoom: 12
});
map.addControl(new mapboxgl.NavigationControl());

let busMarker = null;
const socket = io();

// Live bus tracking
socket.on('location', (data) => {
  const { lat, lng } = data;
  if (!busMarker) {
    const el = document.createElement('div');
    el.style.backgroundImage = 'url("/images/bus.png")';
    el.style.backgroundSize = 'cover';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.borderRadius = '50%';
    el.style.cursor = 'pointer';
    busMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
  } else {
    busMarker.setLngLat([lng, lat]);
  }
  map.flyTo({ center: [lng, lat], zoom: 14 });
});

// PARENT NOTIFICATIONS
const notifBell = document.getElementById("notifBell");
const notifDropdown = document.getElementById("notifDropdown");
const notifCount = document.getElementById("notifCount");

let notifications = [];
const parentId = me?._id ? String(me._id) : (me?.parent_id ? String(me.parent_id) : null);

if (!parentId) showError("No parentId found in session — notifications will not work");

async function loadNotifications() {
  if (!parentId) return;
  try {
    const res = await apiFetch(`/api/notifications/parent/${parentId}`);
    const oldCount = notifications.length;
     //Filter out notifications that are 'read' and older than 5 days
    const now = new Date();
    notifications = (res || []).filter(n => {
      const receiver = n.receivers.find(
        r => String(r.receiver_id) === String(parentId) &&
             r.receiver_role === "parent"
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
        showToast(`${latest.notification.type?.toUpperCase() || "ALERT"}: ${latest.notification.message}`);
      }
    }
  } catch (err) {
    showError("Failed to load parent notifications");
  }
}

function renderNotifications() {
  notifCount.textContent = notifications.filter(n =>
    n.receivers.some(r =>
      String(r.receiver_id) === String(parentId) &&
      r.receiver_role === "parent" &&
      r.status === "unread"
    )
  ).length;

  notifDropdown.innerHTML =
    notifications.map(n => {
      const note = n.notification || {};
      const receiver = n.receivers.find(r =>
        String(r.receiver_id) === String(parentId) &&
        r.receiver_role === "parent"
      );
      const cls = receiver?.status === "unread" ? "notif-item unread" : "notif-item";
      return `<div class="${cls}" onclick="markRead('${n.sent_id}')">
        <strong>${note.type?.toUpperCase() || "ALERT"}</strong>: ${note.message}<br>
        <small>${new Date(n.sent_at).toLocaleString()}</small>
      </div>`;
    }).join("") || "<div class='notif-item'>No notifications</div>";
}

async function markRead(sentId) {
  if (!parentId) return;
  try {
    await apiFetch(`/api/notifications/mark-read/${sentId}/${parentId}`, "PUT");
    await loadNotifications();
    showSuccess("Notification marked as read");
  } catch (err) {
    showError("Failed to mark notification as read");
  }
}

notifBell.addEventListener("click", () => notifDropdown.classList.toggle("hidden"));
let notifInterval = null;

function startNotifications() {
  if (notifInterval) clearInterval(notifInterval);
  setTimeout(() => {
    loadNotifications();
    notifInterval = setInterval(loadNotifications, 10000);
  }, 1500); // wait 1.5s to ensure session cookie sync
}

startNotifications();

document.addEventListener("click", (e) => {
  if (!notifBell.contains(e.target) && !notifDropdown.contains(e.target)) {
    notifDropdown.classList.add("hidden");
  }
});


// QR CARDS SECTION
async function loadParentQrCards() {
  try {
    const parent = JSON.parse(sessionStorage.getItem("session")).user;
    const res = await fetch(`/api/parents/${parent._id}/qr-cards`);
    const cards = await res.json();

    const container = document.getElementById("parentQrContainer");
    container.innerHTML = "";

    if (!cards.length) {
      container.innerHTML = "<p>No QR cards found.</p>";
      return;
    }

    cards.forEach(c => {
      const card = document.createElement("div");
      card.className = "qr-card";
      card.innerHTML = `
        <h3>${c.name}</h3>
        <p><strong>ID:</strong> ${c.student_id}</p>
        ${c.card_url
          ? `<img src="${c.card_url}" alt="QR Card" class="qr-img" />
             <div class="qr-actions">
               <button class="btn small" onclick="downloadQrCard('${c.card_url}', '${c.name}')">Download</button>
               <button class="btn small" onclick="printQrCard('${c.card_url}', '${c.name}')">Print</button>
             </div>`
          : `<p style="color:red;">No QR card generated</p>`}
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load parent QR cards:", err);
  }
}

/* Download + Print Functions */
function downloadQrCard(url, name) {
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}_QRCard.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.downloadQrCard = downloadQrCard; 

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
window.printQrCard = printQrCard; 

// ABSENCE REPORT (SPRINT 4)

async function loadAbsenceList() {
  console.log("loadAbsenceList() called");

  const stored = JSON.parse(sessionStorage.getItem("session") || "null");
  const parent = stored?.user || null;
  console.log("Parent loaded:", parent);

  const listEl = document.getElementById("absenceList");
  if (!parent || !parent.children || parent.children.length === 0) {
    listEl.innerHTML = "<p>No children found.</p>";
    return;
  }

  try {
    // 1. Fetch all students already marked absent
    const res = await fetch("/api/absence/today", {
      credentials: "include",
    });
    const absentIds = await res.json();

    // 2. Build the cards dynamically
    listEl.innerHTML = parent.children.map(child => {
      const isAbsent = Array.isArray(absentIds) && absentIds.includes(child.student_id);
      const buttonText = isAbsent ? "✅ Already Reported" : "🚫 Report Absence";
      const style = isAbsent
        ? "background:#ccc; color:#555; cursor:not-allowed;"
        : "";

      return `
        <div class="card" data-student="${child.student_id}" style="padding:10px; border:1px solid #ddd; border-radius:8px;">
          <strong>${child.name}</strong> — <span>${child.student_id}</span><br>
          <button class="btn small" style="${style}"
            onclick="reportAbsence('${child.student_id}','${child.assigned_bus_id?._id || ''}','${child.name}', this)">
            ${buttonText}
          </button>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error(" Error loading absences:", err);
    listEl.innerHTML = "<p style='color:red;'>Failed to load absences</p>";
  }
}

async function reportAbsence(studentId, busId, name, btn) {
  if (!busId) {
    showError("This student is not assigned to a bus yet.");
    return;
  }

  const stored = JSON.parse(sessionStorage.getItem("session") || "null");
  const parent = stored?.user || null;
  const parentId = parent?._id || parent?.parent_id;

  try {
    const res = await fetch("/api/absence/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ studentId, busId, parentId }),
    });

    const data = await res.json();

    // Handle duplicate absence attempts (409)
    if (res.status === 409) {
      showError(data.message || "This student is already marked absent for today");
      return;
    }

    // Handle other errors
    if (!res.ok) throw new Error(data.message || "Failed to report absence");

    // Success case
    showSuccess(`Absence reported for ${name}`);
    btn.textContent = "✅ Already Reported";
    btn.style.background = "#ccc";
    btn.style.color = "#555";
    btn.style.cursor = "not-allowed";
  } catch (err) {
    console.error("Error reporting absence:", err);
    showError(err.message || "Error reporting absence");
  }
}



// SECTION HANDLER
function showSection(id) {
  console.log(`Switching to: ${id}`);
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "qrSection") loadParentQrCards();
  if (id === "absenceSection") loadAbsenceList();
}

window.showSection = showSection;

// INITIAL LOAD

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded — parent.js active");
});

showSection('mapSection');

loadParentQrCards()

