// presentation/js/parent.js
const session = Auth.requireRole('parent');
const stored = JSON.parse(sessionStorage.getItem('session') || 'null');
const me = stored?.user || null;

const detailsEl = document.getElementById('childDetails');

if (!me || !me.children || me.children.length === 0) {
  detailsEl.innerHTML = 'No child details available';
} else {
  // Show parent info once at the top
  let html = `
  <div class="key">Parent</div><div>${me.username}</div>
`;
// Show info for each student associated with the parent
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


// ================= MAPBOX =================
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

socket.on('location', (data) => {
  const { lat, lng } = data;

  if (!busMarker) {
    const el = document.createElement('div');
    el.style.backgroundImage = 'url("images/bus.png")';
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

// ================== NOTIFICATIONS (PARENT) ================== 
const notifBell = document.getElementById("notifBell");
const notifDropdown = document.getElementById("notifDropdown");
const notifCount = document.getElementById("notifCount");

let notifications = [];

const parentId = me?._id ? String(me._id) : (me?.parent_id ? String(me.parent_id) : null);

if (!parentId) {
  showError("No parentId found in session — notifications will not work");
}

// Fetch notifications for parent
async function loadNotifications() {
  if (!parentId) return;

  try {
    const res = await apiFetch(`/api/notifications/parent/${parentId}`);
    const oldCount = notifications.length;

    notifications = res || [];
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
    showError("Failed to load parent notifications");
  }
  
}

// Render notifications in dropdown
function renderNotifications() {
  // Count unread for this parent
  notifCount.textContent = notifications.filter(n =>
    n.receivers.some(
      r => String(r.receiver_id) === String(parentId) &&
           r.receiver_role === "parent" &&
           r.status === "unread"
    )
  ).length;

  
  notifDropdown.innerHTML =
    notifications.map(n => {
      const note = n.notification || {};
      const receiver = n.receivers.find(
        r => String(r.receiver_id) === String(parentId) &&
             r.receiver_role === "parent"
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
  if (!parentId) return;
  try {
    await apiFetch(`/api/notifications/mark-read/${sentId}/${parentId}`, "PUT");
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

// Auto-refresh notifications every 10s
setInterval(loadNotifications, 10000);
loadNotifications();

// Close dropdown if clicking outside
document.addEventListener("click", (e) => {
  if (!notifBell.contains(e.target) && !notifDropdown.contains(e.target)) {
    notifDropdown.classList.add("hidden");
  }
});

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
        ${
          c.card_url
            ? `
              <img src="${c.card_url}" alt="QR Card" class="qr-img" />
              <div class="qr-actions">
                <button class="btn small" onclick="downloadQrCard('${c.card_url}', '${c.name}')">Download</button>
                <button class="btn small" onclick="printQrCard('${c.card_url}', '${c.name}')">Print</button>
              </div>
            `
            : `<p style="color:red;">No QR card generated</p>`
        }
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load parent QR cards:", err);
  }
}

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "qrSection") loadParentQrCards();
}


loadParentQrCards();

