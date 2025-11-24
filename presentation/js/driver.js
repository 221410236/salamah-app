// presentation/js/driver.js 

const session = Auth.requireRole("driver");
const stored = JSON.parse(sessionStorage.getItem("session") || "null");
const me = stored?.user || null;

// DRIVER STUDENT LIST
if (!me) {
  document.getElementById("studentsTable").innerHTML = "No students";
} else {
  const students = me.students || [];
  const table = document.getElementById("studentsTable");

  if (!students.length) {
    table.innerHTML = "No students assigned";
  } else {
    const rows = students
      .map(
        (s, i) => `
      <tr data-student-id="${s.student_id}">
        <td>${s.name}</td>
        <td>${s.student_id}</td>
        <td>Stop #${i + 1}</td>
      </tr>`
      )
      .join("");

    table.innerHTML = `
      <table class="table">
        <thead><tr><th>Student</th><th>ID</th><th>Stop</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    //Highlight Absent Students & Filter Stops on Page Load
    fetch("/api/absence/today")
      .then(res => res.json())
      .then(absentIds => {
        if (!Array.isArray(absentIds) || absentIds.length === 0) return;

        // mark rows red
        absentIds.forEach(id => {
          const row = document.querySelector(`#studentsTable tr[data-student-id="${id}"]`);
          if (row) {
            row.style.backgroundColor = "#ffe6e6";
            row.style.color = "#b30000";
            row.style.fontWeight = "bold";
          }
        });

        // wrap drawRoute to skip absent students automatically
        const originalDrawRoute = drawRoute;
        
        drawRoute = async (waypoints) => {
          // 1) Remove only absent students from each stop
          const cleaned = waypoints
          .map(wp => {
            if (!wp.student_ids) return wp;
            const newIds = [];
            const newNames = [];
            wp.student_ids.forEach((id, idx) => {
              if (!absentIds.includes(id)) {
                newIds.push(id);
                newNames.push(wp.names[idx]);
              }
            });
            return {
              ...wp,
              student_ids: newIds,
              names: newNames,
            };
          })
          // 2) Remove whole stop only if ALL students absent
          .filter(wp => wp.student_ids.length > 0);
          console.log("After cleaning absent students:", cleaned);
          await originalDrawRoute(cleaned);
        };

      })
      .catch(err => console.error("Error fetching absences:", err));
    }
  }

//  MAPBOX INITIALIZATION
mapboxgl.accessToken =
  "pk.eyJ1IjoiaGFsYWhwc3UiLCJhIjoiY21mYTVyMDc3MWduODJpcGZibXo4Zm4ydCJ9.39r6v4E1LpxdLGQm1Y_Gfg";

  const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  center: [46.6753, 24.7136],
  zoom: 12,
  });
  map.addControl(new mapboxgl.NavigationControl());

  const SCHOOL = [46.6672, 24.72518];
  let driverMarker = null;
  window.stopMarkers = [];
  window.activeRouteData = { waypoints: [] };

// DRAW ROUTE FUNCTION
async function drawRoute(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    showError("No waypoints to draw.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const origin = [pos.coords.longitude, pos.coords.latitude];
      const coords = [
        origin,
        ...waypoints.map((wp) =>
          Array.isArray(wp) ? wp : [wp.lng, wp.lat]
        ),
        SCHOOL,
      ];
      const waypointsStr = coords.map((c) => c.join(",")).join(";");

      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${waypointsStr}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      const route = data.routes?.[0]?.geometry;
      if (!route) return showError("Could not generate route.");

      // remove old route
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: route },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#007cbf", "line-width": 5 },
      });

      // clear old markers
      if (window.stopMarkers.length > 0)
        window.stopMarkers.forEach((m) => m.remove());
      window.stopMarkers = [];

      // add stop markers
      waypoints.forEach((stop, i) => {
        const el = document.createElement("div");
        el.style.backgroundImage = 'url("/images/home.png")';
        el.style.backgroundSize = "cover";
        el.style.width = "40px";
        el.style.height = "40px";

        const marker = new mapboxgl.Marker(el)
          .setLngLat(Array.isArray(stop) ? stop : [stop.lng, stop.lat])
          .setPopup(
            new mapboxgl.Popup().setText(
              `Stop #${i + 1}\n${(stop.names || []).filter(n => n).join(" & ")}`
            )
          )
          .addTo(map);
        window.stopMarkers.push(marker);
      });

      // school marker
      const schoolEl = document.createElement("div");
      schoolEl.style.backgroundImage = 'url("/images/school.png")';
      schoolEl.style.backgroundSize = "cover";
      schoolEl.style.width = "40px";
      schoolEl.style.height = "40px";
      new mapboxgl.Marker(schoolEl)
        .setLngLat(SCHOOL)
        .setPopup(new mapboxgl.Popup().setText("School"))
        .addTo(map);

      // save current route
      window.activeRouteData = { waypoints };
      console.log("Route drawn with", waypoints.length, "stops");
    } catch (err) {
      console.error("Error drawing route:", err);
    }
  });
}


// SOCKET.IO CONNECTION + Real-time Absence Handling
const socket = io();

function sendLocation() {
  if (!navigator.geolocation) return;
  
  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    const data = { 
      lat, 
      lng, 
      bus_id: me?.bus?.bus_id 
    };

    if (!driverMarker) {
      const el = document.createElement("div");
      el.style.backgroundImage = 'url("/images/bus.png")';
      el.style.backgroundSize = "cover";
      el.style.width = "40px";
      el.style.height = "40px";
      driverMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
      map.flyTo({ center: [lng, lat], zoom: 14 });
    } else {
      driverMarker.setLngLat([lng, lat]);
    }

    socket.emit("location", data);
  });
}

setInterval(sendLocation, 5000);
sendLocation();

socket.on("student:absent", (data) => {
  const { studentId, studentName } = data;
  console.log("Absence received:", data);

  const row = document.querySelector(`#studentsTable tr[data-student-id="${studentId}"]`);
  if (row) {
    row.style.backgroundColor = "#ffe6e6";
    row.style.color = "#b30000";
    row.style.fontWeight = "bold";
  }

  // REMOVE ONLY THE ABSENT CHILD FROM SIBLING GROUP
  let updated = window.activeRouteData.waypoints.map(wp => {
    if ((wp.student_ids || []).includes(studentId)) {
    const index = wp.student_ids.indexOf(studentId);
    wp.student_ids.splice(index, 1);
    wp.names.splice(index, 1);
  }
  return wp;
});

// remove the whole stop only if no siblings left
updated = updated.filter(wp => wp.student_ids.length > 0);

window.activeRouteData.waypoints = updated;
drawRoute(updated);

  showToast(`${studentName} marked absent — route updated`);
});


// EMERGENCY NOTIFICATION
const emergencyModal = document.getElementById("emergencyModal");

document.getElementById("sendEmergencyBtn")?.addEventListener("click", () => {
  emergencyModal.classList.remove("hidden");
});

document.getElementById("closeEmergency")?.addEventListener("click", () => {
  emergencyModal.classList.add("hidden");
});

document.getElementById("submitEmergency")?.addEventListener("click", async () => {
  const type = document.getElementById("emergencyType").value;
  const messageInput = document.getElementById("emergencyMessage").value.trim();

  if (!type) return showError("Please select an emergency type");

  const bus_id = me?.bus?.bus_id;
  if (!bus_id) return showError("Bus not found. Cannot send emergency.");

  const message =
    messageInput.length >= 10
      ? messageInput
      : `Emergency reported: ${type}`;

  try {
    const res = await fetch("/api/notifications/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message, bus_id }),
    });

    let text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || parsed.error || text;
    } catch {}

    if (res.ok) {
      showSuccess(msg);
      emergencyModal.classList.add("hidden");
      document.getElementById("emergencyType").value = "";
      document.getElementById("emergencyMessage").value = "";
    } else {
      showError(msg);
    }

  } catch (err) {
    console.error("Emergency error:", err);
    showError("Failed to send emergency notification");
  }
});


// QR SCANNER & BUTTON INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  const busId = me?.bus?._id || null;
  const resultEl = document.getElementById("scan-result");
  const openBtn = document.getElementById("openScanner");
  const qrModal = document.getElementById("qrScannerModal");
  const closeModal = document.getElementById("closeQRScanner");
  const drawBtn = document.getElementById("drawRoute");
  const flyBtn = document.getElementById("flyToMe");

  // Show Route
  drawBtn?.addEventListener("click", async () => {
    try {
      const res = await fetch(`/api/drivers/route/${me.driver_id}`);
      const data = await res.json();

      if (!data.waypoints || !data.waypoints.length) {
        showError("No student home locations found.");
        return;
      }

      window.activeRouteData = { waypoints: data.waypoints };
      await drawRoute(data.waypoints);
      showSuccess("Route loaded successfully!");
    // Update student table with correct stop numbers
    const students = me.students || [];
    const wpList = data.waypoints;
    
    students.forEach(s => {
      const row = document.querySelector(`#studentsTable tr[data-student-id="${s.student_id}"]`);
      if (!row) return;
      // find which waypoint contains this student's ID
      const stopIndex = wpList.findIndex(w => (w.student_ids || []).includes(s.student_id));
      
      if (stopIndex !== -1) {
        row.cells[2].innerText = `Stop #${stopIndex + 1}`;
      } else {
        row.cells[2].innerText = `Absent`;
      }
    });

    } catch (err) {
      console.error(err);
      showError("Error creating route.");
    }
  });

  // Fly To Me
  flyBtn?.addEventListener("click", () => {
    if (!driverMarker) return showError("Location not available yet.");
    const lngLat = driverMarker.getLngLat();
    map.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 14 });
    showSuccess("Centered on your location");
  });

  //QR SCANNER
  let html5QrCode = null;
  async function sendScan(studentId) {
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, busId }),
    });

    const data = await response.json();
    const msg = data.message || "Scan processed";

    // Always show popup for all three conditions:
    // boarded, dropped off, duplicate
    showSuccess(msg);

  } catch (error) {
    console.error("Error sending scan:", error);
    showError("Error sending scan");
  }
}

  let lastScanTime = 0;

  function onScanSuccess(decodedText) {
  const now = Date.now();

  // Ignore scans that come within 1200ms
  if (now - lastScanTime < 1200) return;
  lastScanTime = now;

  let studentId = decodedText;
  try {
    const parsed = JSON.parse(decodedText);
    if (parsed?.student_id) studentId = parsed.student_id;
  } catch {}

  resultEl.textContent = `Scanned student ID: ${studentId}`;
  sendScan(studentId);
}


  openBtn?.addEventListener("click", () => {
    qrModal.classList.remove("hidden");
    resultEl.textContent = "Starting camera...";
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode
      .start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
      .catch((err) => {
        console.error("Unable to start scanner:", err);
        resultEl.textContent = "Camera access denied or unavailable.";
      });
  });

  closeModal?.addEventListener("click", () => {
    if (html5QrCode) {
      html5QrCode
        .stop()
        .then(() => {
          html5QrCode.clear();
          qrModal.classList.add("hidden");
        })
        .catch((err) => {
          console.error("Error stopping scanner:", err);
          qrModal.classList.add("hidden");
        });
    } else qrModal.classList.add("hidden");
  });
});
