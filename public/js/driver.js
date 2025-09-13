// public/js/driver.js
const session = Auth.requireRole('driver');
const stored = JSON.parse(sessionStorage.getItem('session') || 'null');
const me = stored?.user || null;

if (!me) {
  document.getElementById('studentsTable').innerHTML = 'No students';
} else {
  const students = me.students || [];

  if (students.length > 0) {
    const rows = students.map(s =>
      `<tr><td>${s.name}</td><td>${s.student_id}</td></tr>`
    ).join('');

    document.getElementById('studentsTable').innerHTML =
      `<table class="table">
         <thead><tr><th>Student</th><th>ID</th></tr></thead>
         <tbody>${rows}</tbody>
       </table>`;
  } else {
    document.getElementById('studentsTable').innerHTML = 'No students assigned';
  }
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

const directions = new MapboxDirections({
  accessToken: mapboxgl.accessToken,
  unit: 'metric',
  profile: 'driving',
  interactive: false,
  controls: { inputs: false, instructions: false }
});
map.addControl(directions, 'top-left');

const SCHOOL = [46.66720, 24.72518];

document.getElementById('drawRoute').addEventListener('click', () => {
  directions.setOrigin(map.getCenter());
  directions.setDestination(SCHOOL);
});

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
      el.style.backgroundImage = 'url("images/bus.png")';
      el.style.backgroundSize = 'cover';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.cursor = 'pointer';
      driverMarker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
    } else {
      driverMarker.setLngLat([lng, lat]);
    }

    map.flyTo({ center: [lng, lat], zoom: 14 });

    socket.emit('location', data);
  }, (err) => { console.error(err); });
}

setInterval(sendLocation, 5000);
sendLocation();
