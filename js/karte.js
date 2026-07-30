import { supabase, escapeHtml } from "./app.js";

const mapElement = document.querySelector("#map");
const filter = document.querySelector("#severityFilter");

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

const markerLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  spiderfyOnMaxZoom: true,
  removeOutsideVisibleBounds: true,
  animate: true,
  animateAddingMarkers: false,
  maxClusterRadius: 50,
  chunkedLoading: true,
  iconCreateFunction: clusterIcon
}).addTo(map);

markerLayer.on("clustermouseover", event => {
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

markerLayer.on("clustermouseout", event => {
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

function applyFilter(reports) {
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

function renderMarkers(reports) {
  markerLayer.clearLayers();

  /*
   * Älteste Meldungen zuerst und neueste zuletzt.
   * Dadurch liegt der neueste Pin bei gleichen Koordinaten oben.
   */
  const sortedReports = [...reports].sort((a, b) => {
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const markers = [];

  sortedReports.forEach((report, index) => {
    if (!hasValidCoordinates(report)) {
      return;
    }

    const lat = Number(report.lat);
    const lng = Number(report.lng);
    const severity = Math.max(
      1,
      Math.min(5, Number(report.severity) || 1)
    );

    const marker = L.marker([lat, lng], {
      icon: markerIcon(severity),

      /*
       * Die Belastung wird am Marker gespeichert, damit der Cluster
       * daraus seine Durchschnittsfarbe berechnen kann.
       */
      severity,

      /*
       * Neuere Meldungen erhalten einen höheren Ebenenwert.
       */
      zIndexOffset: index
    });

    marker.bindPopup(popupContent(report, severity), {
      maxWidth: 280
    });

    markers.push(marker);
  });

  markerLayer.addLayers(markers);

  window.setTimeout(() => {
    map.invalidateSize();
  }, 200);
}

async function loadMap() {
  const { data, error } = await supabase
    .from("reports_public")
    .select("id, address, severity, created_at, lat, lng")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "Meldungen konnten nicht geladen werden:",
      error
    );
    return;
  }

  const reports = applyFilter(data || []);

  renderMarkers(reports);
}

filter?.addEventListener("change", loadMap);

window.addEventListener("focus", loadMap);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadMap();
  }
});

/*
 * Sicherheitshalber alle 60 Sekunden neu laden.
 */
window.setInterval(loadMap, 60000);

loadMap();
