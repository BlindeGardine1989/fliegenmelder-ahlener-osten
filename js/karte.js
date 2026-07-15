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

function publicAddress(address) {
  const value = String(address || "").trim();

  if (!value) {
    return "Ahlener Osten";
  }

  return (
    value
      .replace(
        /\s*\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?\s*$/,
        ""
      )
      .trim() || "Ahlener Osten"
  );
}

function formatDate(date) {
  if (!date) {
    return "–";
  }

  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function markerIcon(severity) {
  return L.divIcon({
    className: "",
    html: `
      <span
        class="marker-dot"
        style="background:${color(severity)}"
      ></span>
    `,
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
    console.error("Meldungen konnten nicht geladen werden:", error);
    return;
  }

  let reports = data || [];
  const value = filter?.value || "all";

  if (value === "4plus") {
    reports = reports.filter(
      report => Number(report.severity) >= 4
    );
  } else if (value !== "all") {
    reports = reports.filter(
      report => String(report.severity) === value
    );
  }

  reports.forEach(report => {
    if (!report.lat || !report.lng) {
      return;
    }

    const lat = Number(report.lat);
    const lng = Number(report.lng);

    const marker = L.marker(
      [lat, lng],
      {
        icon: markerIcon(report.severity)
      }
    ).addTo(map);

    marker.bindPopup(`
      <strong>
        📍 ${escapeHtml(publicAddress(report.address))}
      </strong>
      <br>
      🪰 Belastung: ${escapeHtml(report.severity || "–")}/5
      <br>
      📅 ${formatDate(report.created_at)}
    `);

    markers.push(marker);
  });

  setTimeout(() => {
    map.invalidateSize();
  }, 200);
}

filter?.addEventListener("change", loadMap);

loadMap();
