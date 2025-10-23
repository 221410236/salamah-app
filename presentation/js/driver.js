// presentation/js/driver.js

const session = Auth.requireRole('driver');
const stored = JSON.parse(sessionStorage.getItem('session') || 'null');
const me = stored?.user || null;

// -------------------- STUDENT LIST --------------------
if (!me) {
  document.getElementById('studentsTable').innerHTML = 'No students';
} else {
  const students = me.students || [];
  const table = document.getElementById('studentsTable');

  if (!students.length) {
    table.innerHTML = 'No students assigned';
  } else {
    const rows = students.map((s, i) => `
      <tr>
        <td>${s.name}</td>
        <td>${s.student_id}</td>
        <td>Stop #${i + 1}</td>
      </tr>
    `).join('');

    table.innerHTML = `
      <table class="table">
        <thead><tr><th>Student</th><th>ID</th><th>Stop</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
}

// -------------------- MAPBOX --------------------
mapboxgl.accessToken = 'pk.eyJ1IjoiaGFsYWhwc3UiLCJhIjoiY21mYTVyMDc3MWduODJpcGZibXo4Zm4ydCJ9.39r6v4E1LpxdLGQm1Y_Gfg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [46.6753, 24.7136],
  zoom: 12
});

map.addControl(new mapboxgl.NavigationControl());
const SCHOOL = [46.66720, 24.72518];

document.getElementById('drawRoute').addEventListener('click', async () => {
  try {
    const res = await fetch(`/api/drivers/route/${me.driver_id}`);
    const data = await res.json();

    if (!data.waypoints || !data.waypoints.length) {
      showError("No student home locations found.");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const origin = [pos.coords.longitude, pos.coords.latitude];
      const coords = [origin, ...data.waypoints, SCHOOL];
      const waypointsStr = coords.map(c => c.join(",")).join(";");

      const routeRes = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${waypointsStr}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );

      const routeData = await routeRes.json();
      const route = routeData.routes[0].geometry;

      // Draw route
      if (map.getSource("route")) {
        map.getSource("route").setData(route);
      } else {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route }
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#007cbf", "line-width": 5 }
        });
      }

      // Custom markers
      if (window.stopMarkers) window.stopMarkers.forEach(m => m.remove());
      window.stopMarkers = [];

      data.waypoints.forEach((stop, i) => {
        const el = document.createElement('div');
        el.style.backgroundImage = 'url("/images/home.png")';
        el.style.backgroundSize = 'cover';
        el.style.width = '48px';
        el.style.height = '48px';

        const marker = new mapboxgl.Marker(el)
          .setLngLat(stop)
          .setPopup(new mapboxgl.Popup().setText(`Stop #${i + 1}`))
          .addTo(map);

        window.stopMarkers.push(marker);
      });

      const schoolEl = document.createElement('div');
      schoolEl.style.backgroundImage = 'url("/images/school.png")';
      schoolEl.style.backgroundSize = 'cover';
      schoolEl.style.width = '48px';
      schoolEl.style.height = '48px';

      new mapboxgl.Marker(schoolEl)
        .setLngLat(SCHOOL)
        .setPopup(new mapboxgl.Popup().setText("School"))
        .addTo(map);
    });

  } catch (err) {
    console.error(err);
    showError("Error creating route.");
  }
});

// -------------------- LIVE DRIVER LOCATION --------------------
const socket = io();
let driverMarker = null;

function sendLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    const data = {
      lat,
      lng,
      username: me?.username || null,
      busId: me?.bus?._id || null
    };

    if (!driverMarker) {
      const el = document.createElement('div');
      el.style.backgroundImage = 'url("/images/bus.png")';
      el.style.backgroundSize = 'cover';
      el.style.width = '40px';
      el.style.height = '40px';
      driverMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
      map.flyTo({ center: [lng, lat], zoom: 14 });
    } else {
      driverMarker.setLngLat([lng, lat]);
    }

    socket.emit('location', data);
  });
}

setInterval(sendLocation, 5000);
sendLocation();

document.getElementById('flyToMe').addEventListener('click', () => {
  if (!driverMarker) return showError("Location not available yet.");
  const lngLat = driverMarker.getLngLat();
  map.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 14 });
});

// -------------------- EMERGENCY NOTIFICATION --------------------
const emergencyModal = document.getElementById("emergencyModal");
document.getElementById("sendEmergencyBtn").addEventListener("click", () => emergencyModal.classList.remove("hidden"));
document.getElementById("closeEmergency").addEventListener("click", () => emergencyModal.classList.add("hidden"));

document.getElementById("submitEmergency").addEventListener("click", async () => {
  const type = document.getElementById("emergencyType").value;
  const message = document.getElementById("emergencyMessage").value.trim();

  if (!type) return showError("Please select emergency type");

  try {
    const res = await fetch("/api/notifications/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        message: message || type,
        bus_id: me?.bus?._id || "unknown"
      }),
    });

    const text = await res.text();
    if (res.ok) {
      showSuccess(text || "Emergency notification sent successfully");
      emergencyModal.classList.add("hidden");
      document.getElementById("emergencyType").value = "";
      document.getElementById("emergencyMessage").value = "";
    } else showError(text || "Failed to send notification");

  } catch (err) {
    console.error(err);
    showError("Failed to send notification");
  }
});

// -------------------- QR CODE SCANNER --------------------
document.addEventListener("DOMContentLoaded", () => {
  const busId = me?.bus?._id || null;
  const resultEl = document.getElementById("scan-result");
  const openBtn = document.getElementById("openScanner");
  const qrModal = document.getElementById("qrScannerModal");
  const closeModal = document.getElementById("closeQRScanner");
  let html5QrCode = null;

  async function sendScan(studentId) {
    try {
      const response = await fetch("http://localhost:5000/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, busId })
      });

      const data = await response.json();
      resultEl.textContent = data.message || "Scan recorded successfully!";
      showSuccess(data.message || "Scan recorded successfully!");
    } catch (error) {
      console.error("Error sending scan:", error);
      resultEl.textContent = "Error sending scan.";
      showError("Error sending scan");
    }
  }
  
let lastScanId = null;

function onScanSuccess(decodedText) {
  // prevent re-scanning same code within 0.8s
  if (decodedText === lastScanId) return;
  lastScanId = decodedText;
  setTimeout(() => (lastScanId = null), 800);

  if (html5QrCode?.isScanning) {
    try { html5QrCode.pause(true); } catch (_) {}
  }

  let studentId = decodedText;
  try {
    const parsed = JSON.parse(decodedText);
    if (parsed?.student_id) studentId = parsed.student_id;
  } catch (_) {}

  resultEl.textContent = `Scanned student ID: ${studentId}`;
  sendScan(studentId);

  try { html5QrCode.resume(); } catch (_) {}
}


  openBtn.addEventListener("click", () => {
    qrModal.classList.remove("hidden");
    resultEl.textContent = "Starting camera...";

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      onScanSuccess
    ).catch(err => {
      console.error("Unable to start scanner:", err);
      resultEl.textContent = "Camera access denied or unavailable.";
    });
  });

  closeModal.addEventListener("click", () => {
    if (html5QrCode) {
      html5QrCode.stop().then(() => {
        html5QrCode.clear();
        qrModal.classList.add("hidden");
      }).catch(err => {
        console.error("Error stopping scanner:", err);
        qrModal.classList.add("hidden");
      });
    } else qrModal.classList.add("hidden");
  });
});
