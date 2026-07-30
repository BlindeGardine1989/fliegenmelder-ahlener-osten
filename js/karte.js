import { supabase, escapeHtml } from "./app.js";

const mapElement = document.querySelector("#map");
const filter = document.querySelector("#severityFilter");

if (!mapElement) {
  throw new Error("Das Kartenelement #map wurde nicht gefunden.");
}

const map = L.map(mapElement).setView([51.763, 7.895], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap-Mitwirkende"
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

let isLoading = false;

function color(severity) {
  const value = Number(severity);

  if (value === 1) return "#2e7d32";
  if (value === 2) return "#79bf5b";
  if (value === 3) return "#f2b705";
  if (value === 4) return "#ef7d00";

  return "#d51f28";
}

function publicAddress(address) {
  const value = String(address || "").trim();

  if (!value) {
    return "Ahlener Osten";
  }

  const withoutNumber = value
    .replace(
      /\s*\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?\s*$/,
      ""
    )
    .trim();

  const normalized = withoutNumber
    .replace(/^Bergstr\.?$/i, "Bergstraße")
    .replace(/^Bergstrasse\.?$/i, "Bergstraße")
    .replace(/^Jägerstr\.?$/i, "Jägerstraße")
    .replace(/^Jaegerstr\.?$/i, "Jägerstraße")
    .replace(/^Jägerstrasse\.?$/i, "Jägerstraße");

  return normalized || "Ahlener Osten";
}

function formatDate(date) {
  if (!date) {
    return "–";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "–";
  }

  return parsedDate.toLocaleDateString("de-DE", {
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
        aria-hidden="true"
      ></span>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10]
  });
}

function hasValidCoordinates(report) {
  const lat = Number(report?.lat);
  const lng = Number(report?.lng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function filterReports(reports) {
  const selectedValue = filter?.value || "all";

  if (selectedValue === "4plus") {
    return reports.filter(
      report => Number(report.severity) >= 4
    );
  }

  if (selectedValue !== "all") {
    return reports.filter(
      report => String(report.severity) === selectedValue
    );
  }

  return reports;
}

function renderMarkers(reports) {
  markerLayer.clearLayers();

  reports.forEach(report => {
    if (!hasValidCoordinates(report)) {
      console.warn(
        "Meldung ohne gültige öffentliche Koordinaten:",
        report
      );
      return;
    }

    const lat = Number(report.lat);
    const lng = Number(report.lng);

    const severity = Number(report.severity) || 1;

    const marker = L.marker([lat, lng], {
      icon: markerIcon(severity)
    });

    marker.bindPopup(`
      <strong>
        📍 ${escapeHtml(publicAddress(report.address))}
      </strong>
      <br>
      🪰 Belastung: ${escapeHtml(severity)}/5
      <br>
      📅 ${escapeHtml(formatDate(report.created_at))}
    `);

    marker.addTo(markerLayer);
  });

  window.setTimeout(() => {
    map.invalidateSize();
  }, 150);
}

async function loadMap() {
  if (isLoading) {
    return;
  }

  isLoading = true;

  try {
    const { data, error } = await supabase
      .from("reports_public")
      .select("id, address, severity, created_at, lat, lng")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const reports = filterReports(data || []);

    renderMarkers(reports);
  } catch (error) {
    console.error(
      "Meldungen konnten nicht geladen werden:",
      error
    );
  } finally {
    isLoading = false;
  }
}

filter?.addEventListener("change", () => {
  loadMap();
});

/*
 * Sobald sich die Tabelle reports ändert, werden die öffentlichen
 * Daten erneut geladen. Eine Meldung erscheint dadurch nach ihrer
 * Freigabe automatisch auf der geöffneten Karte.
 */
const reportsChannel = supabase
  .channel("public-map-reports")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "reports"
    },
    () => {
      window.setTimeout(() => {
        loadMap();
      }, 500);
    }
  )
  .subscribe(status => {
    if (status === "CHANNEL_ERROR") {
      console.warn(
        "Die automatische Kartenaktualisierung konnte nicht gestartet werden."
      );
    }
  });

/*
 * Zusätzliche Aktualisierung alle 60 Sekunden.
 * Dadurch erscheinen neue Pins auch dann, wenn Realtime in Supabase
 * für die Tabelle nicht aktiviert sein sollte.
 */
const refreshInterval = window.setInterval(() => {
  loadMap();
}, 60000);

window.addEventListener("focus", () => {
  loadMap();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadMap();
  }
});

window.addEventListener("beforeunload", () => {
  window.clearInterval(refreshInterval);
  supabase.removeChannel(reportsChannel);
});

loadMap();
