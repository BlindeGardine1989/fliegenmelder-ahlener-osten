import { supabase, escapeHtml } from "./app.js";

const mapElement = document.querySelector("#map");
const filter = document.querySelector("#severityFilter");

const map = L.map(mapElement).setView([51.763, 7.895], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap-Mitwirkende"
}).addTo(map);

let markers = [];

function color(severity) {
  const s = Number(severity);
  if (s === 1) return "#2e7d32";
  if (s === 2) return "#79bf5b";
  if (s === 3) return "#f2b705";
  if (s === 4) return "#ef7d00";
  return "#d51f28";
}

function clearMarkers() {
  markers.forEach(marker => marker.remove());
  markers = [];
}

function markerIcon(severity) {
  return L.divIcon({
    className: "",
    html: `<span class="marker-dot" style="background:${color(severity)}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

async function loadMap() {
  clearMarkers();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("visible", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  let reports = data || [];
  const value = filter?.value || "all";

  if (value === "4plus") {
    reports = reports.filter(r => Number(r.severity) >= 4);
  } else if (value !== "all") {
    reports = reports.filter(r => String(r.severity) === value);
  }

  reports.forEach(r => {
    if (!r.lat || !r.lng) return;

const lat = Number(r.lat);
const lng = Number(r.lng);

    const marker = L.marker([lat, lng], {
      icon: markerIcon(r.severity)
    }).addTo(map);

    marker.bindPopup(`
      <strong>Belastung: ${escapeHtml(r.severity || "–")}/5</strong><br>
      ${escapeHtml(r.address || "Ort nicht angegeben")}<br>
      ${escapeHtml(r.note || "")}
    `);

    markers.push(marker);
  });

  setTimeout(() => map.invalidateSize(), 200);
}

filter?.addEventListener("change", loadMap);
loadMap();
