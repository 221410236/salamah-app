// public/js/parent.js
const session = Auth.requireRole('parent');
const stored = JSON.parse(sessionStorage.getItem('session') || 'null');
const me = stored?.user || null;

const detailsEl = document.getElementById('childDetails');

if (!me || !me.children || me.children.length === 0) {
  detailsEl.innerHTML = 'No child details available';
} else {
  const student = me.children[0];
  const bus = student.assigned_bus_id;
  const driver = bus?.driver_id;

  const fields = [
    ['Parent', me.username],
    ['Student', `${student.name} (${student.student_id})`],
    ['Bus', bus ? bus.plate_number : '—'],
    ['Driver', driver ? driver.username : 'TBD'],
    ['Driver Phone', driver ? driver.phone_number: '—']
  ];

  detailsEl.innerHTML = fields.map(([k, v]) =>
    `<div class="key">${k}</div><div>${v}</div>`
  ).join('');
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
