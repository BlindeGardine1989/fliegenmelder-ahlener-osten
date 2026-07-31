import { supabase, escapeHtml } from "./app.js";

const mapElement = document.querySelector("#map");
const severityFilter = document.querySelector("#severityFilter");
const timeFilter = document.querySelector("#timeFilter");
const resultCount = document.querySelector("#mapResultCount");
const viewButtons = document.querySelectorAll("[data-map-view]");

const dashboardCount = document.querySelector("#dashboardCount");
const dashboardStreets = document.querySelector("#dashboardStreets");
const dashboardAverage = document.querySelector("#dashboardAverage");
const dashboardLatest = document.querySelector("#dashboardLatest");

if (!mapElement) {
  throw new Error("Das Kartenelement #map wurde nicht gefunden.");
}

if (typeof L === "undefined") {
  throw new Error("Leaflet wurde nicht geladen.");
}

if (typeof L.markerClusterGroup !== "function") {
  throw new Error(
    "Leaflet.markercluster wurde nicht geladen. Bitte prüfe karte.html."
  );
}

const map = L.map(mapElement).setView([51.763, 7.895], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap-Mitwirkende"
}).addTo(map);

let isLoadingMap = false;
let allReports = [];
let currentMapView = "cluster";

function color(severity) {
  const value = Number(severity);

  if (value <= 1) return "#2e7d32";
  if (value <= 2) return "#79bf5b";
  if (value <= 3) return "#f2b705";
  if (value <= 4) return "#ef7d00";

  return "#d51f28";
}

function severityClass(severity) {
  const value = Math.max(
    1,
    Math.min(5, Math.round(Number(severity) || 1))
  );

  return `s${value}`;
}

function severityLabel(severity) {
  const value = Number(severity);

  if (value === 1) return "sehr gering";
  if (value === 2) return "gering";
  if (value === 3) return "mittel";
  if (value === 4) return "stark";

  return "sehr stark";
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

function formatLatestDate(date) {
  if (!date) {
    return "–";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "–";
  }

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const reportStart = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );

  const differenceInDays = Math.round(
    (todayStart - reportStart) / 86400000
  );

  if (differenceInDays === 0) {
    return "Heute";
  }

  if (differenceInDays === 1) {
    return "Gestern";
  }

  return parsedDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}

function formatAverage(value) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function markerIcon(severity) {
  return L.divIcon({
    className: "",
    html: `
      <span
        class="marker-dot"
        style="background:${color(severity)}"
        title="Belastung ${escapeHtml(severity)} von 5"
      ></span>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10]
  });
}

function averageClusterSeverity(cluster) {
  const childMarkers = cluster.getAllChildMarkers();

  if (!childMarkers.length) {
    return 1;
  }

  const total = childMarkers.reduce((sum, marker) => {
    return sum + (Number(marker.options.severity) || 1);
  }, 0);

  return total / childMarkers.length;
}

function clusterIcon(cluster) {
  const count = cluster.getChildCount();
  const average = averageClusterSeverity(cluster);
  const level = severityClass(average);

  return L.divIcon({
    className: "fly-cluster",
    html: `
      <div
        class="fly-cluster__circle fly-cluster__circle--${level}"
        title="${escapeHtml(count)} Meldungen, durchschnittliche Belastung ${escapeHtml(average.toFixed(1))} von 5"
      >
        <span class="fly-cluster__fly" aria-hidden="true">🪰</span>
        <span class="fly-cluster__count">${escapeHtml(count)}</span>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
}

const clusterLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  spiderfyOnMaxZoom: true,
  removeOutsideVisibleBounds: true,
  animate: true,
  animateAddingMarkers: false,
  maxClusterRadius: 50,
  chunkedLoading: true,
  iconCreateFunction: clusterIcon
});

const singleMarkerLayer = L.layerGroup();

clusterLayer.addTo(map);

clusterLayer.on("clustermouseover", event => {
  const cluster = event.layer;
  const count = cluster.getChildCount();
  const average = averageClusterSeverity(cluster);

  cluster.bindTooltip(
    `
      <div class="cluster-tooltip">
        <strong>${escapeHtml(count)} Meldungen</strong>
        Ø Belastung ${escapeHtml(average.toFixed(1))} / 5
        <br>
        Zum Öffnen hineinzoomen
      </div>
    `,
    {
      direction: "top",
      offset: [0, -18],
      opacity: 0.96
    }
  );

  cluster.openTooltip();
});

clusterLayer.on("clustermouseout", event => {
  event.layer.closeTooltip();
});

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

function applySeverityFilter(reports) {
  const selectedValue = severityFilter?.value || "all";

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

function applyTimeFilter(reports) {
  const selectedValue = timeFilter?.value || "all";

  if (selectedValue === "all") {
    return reports;
  }

  const now = new Date();
  let startDate;

  if (selectedValue === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    const numberOfDays = Number(selectedValue);

    if (!Number.isFinite(numberOfDays)) {
      return reports;
    }

    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - numberOfDays);
    startDate.setHours(0, 0, 0, 0);
  }

  return reports.filter(report => {
    const reportDate = new Date(report.created_at);

    return (
      !Number.isNaN(reportDate.getTime()) &&
      reportDate >= startDate
    );
  });
}

function applyFilters(reports) {
  return applySeverityFilter(
    applyTimeFilter(reports)
  );
}

function popupContent(report, severity) {
  const level = severityClass(severity);
  const address = escapeHtml(publicAddress(report.address));
  const date = escapeHtml(formatDate(report.created_at));
  const label = escapeHtml(severityLabel(severity));
  const safeSeverity = escapeHtml(severity);

  return `
    <div class="map-popup">
      <strong class="map-popup__title">
        📍 ${address}
      </strong>

      <span class="map-popup__severity map-popup__severity--${level}">
        🪰 ${safeSeverity}/5 · ${label}
      </span>

      <div class="map-popup__date">
        📅 Gemeldet am ${date}
      </div>
    </div>
  `;
}

function createMarker(report, index) {
  const lat = Number(report.lat);
  const lng = Number(report.lng);

  const severity = Math.max(
    1,
    Math.min(5, Number(report.severity) || 1)
  );

  const marker = L.marker([lat, lng], {
    icon: markerIcon(severity),
    severity,
    zIndexOffset: index
  });

  marker.bindPopup(popupContent(report, severity), {
    maxWidth: 280
  });

  return marker;
}

function updateDashboard(reports) {
  const validReports = reports.filter(hasValidCoordinates);

  const count = validReports.length;

  const streets = new Set(
    validReports
      .map(report => publicAddress(report.address))
      .filter(address => address && address !== "Ahlener Osten")
  );

  const severityValues = validReports
    .map(report => Number(report.severity))
    .filter(value => Number.isFinite(value));

  const average = severityValues.length
    ? severityValues.reduce((sum, value) => sum + value, 0) /
      severityValues.length
    : 0;

  const latestReport = [...validReports]
    .filter(report => {
      const date = new Date(report.created_at);
      return !Number.isNaN(date.getTime());
    })
    .sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    })[0];

  if (dashboardCount) {
    dashboardCount.textContent = String(count);
  }

  if (dashboardStreets) {
    dashboardStreets.textContent = String(streets.size);
  }

  if (dashboardAverage) {
    dashboardAverage.textContent = severityValues.length
      ? `${formatAverage(average)} / 5`
      : "–";
  }

  if (dashboardLatest) {
    dashboardLatest.textContent = latestReport
      ? formatLatestDate(latestReport.created_at)
      : "–";
  }
}

function updateResultCount(count) {
  if (!resultCount) {
    return;
  }

  if (count === 0) {
    resultCount.textContent =
      "Für diese Auswahl liegen keine Meldungen vor.";
    return;
  }

  if (count === 1) {
    resultCount.textContent =
      "1 Meldung entspricht der aktuellen Auswahl.";
    return;
  }

  resultCount.textContent =
    `${count} Meldungen entsprechen der aktuellen Auswahl.`;
}

function updateViewButtons() {
  viewButtons.forEach(button => {
    const isActive =
      button.dataset.mapView === currentMapView;

    button.classList.toggle("is-active", isActive);

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });
}

function updateVisibleLayer() {
  if (currentMapView === "single") {
    if (map.hasLayer(clusterLayer)) {
      map.removeLayer(clusterLayer);
    }

    if (!map.hasLayer(singleMarkerLayer)) {
      singleMarkerLayer.addTo(map);
    }
  } else {
    if (map.hasLayer(singleMarkerLayer)) {
      map.removeLayer(singleMarkerLayer);
    }

    if (!map.hasLayer(clusterLayer)) {
      clusterLayer.addTo(map);
    }
  }

  updateViewButtons();

  window.setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function renderMarkers(reports) {
  clusterLayer.clearLayers();
  singleMarkerLayer.clearLayers();

  const sortedReports = [...reports].sort((a, b) => {
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const clusterMarkers = [];
  const singleMarkers = [];

  sortedReports.forEach((report, index) => {
    if (!hasValidCoordinates(report)) {
      return;
    }

    clusterMarkers.push(
      createMarker(report, index)
    );

    singleMarkers.push(
      createMarker(report, index)
    );
  });

  clusterLayer.addLayers(clusterMarkers);

  singleMarkers.forEach(marker => {
    singleMarkerLayer.addLayer(marker);
  });

  updateDashboard(reports);
  updateResultCount(clusterMarkers.length);
  updateVisibleLayer();
}

function refreshMapDisplay() {
  const reports = applyFilters(allReports);

  renderMarkers(reports);
}

async function loadMap() {
  if (isLoadingMap) {
    return;
  }

  isLoadingMap = true;

  try {
    const { data, error } = await supabase
      .from("reports_public")
      .select("id, address, severity, created_at, lat, lng")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "Meldungen konnten nicht geladen werden:",
        error
      );

      if (resultCount) {
        resultCount.textContent =
          "Die Meldungen konnten momentan nicht geladen werden.";
      }

      return;
    }

    allReports = data || [];
    refreshMapDisplay();
  } finally {
    isLoadingMap = false;
  }
}

viewButtons.forEach(button => {
  button.addEventListener("click", () => {
    const selectedView = button.dataset.mapView;

    if (
      selectedView !== "cluster" &&
      selectedView !== "single"
    ) {
      return;
    }

    currentMapView = selectedView;
    updateVisibleLayer();
  });
});

severityFilter?.addEventListener(
  "change",
  refreshMapDisplay
);

timeFilter?.addEventListener(
  "change",
  refreshMapDisplay
);

window.addEventListener("focus", loadMap);

window.addEventListener("pageshow", event => {
  if (event.persisted) {
    loadMap();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadMap();
  }
});

window.setInterval(loadMap, 60000);

updateViewButtons();
loadMap();
