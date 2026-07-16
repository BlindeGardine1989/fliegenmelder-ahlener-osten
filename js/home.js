import { supabase, escapeHtml, formatDate } from "./app.js";

const mapEl = document.querySelector("#map");
const publicHotspotsEl = document.querySelector("#publicHotspots");
const filterEl = document.querySelector("#severityFilter");
const statTotal = document.querySelector("#statTotal");
const statMonth = document.querySelector("#statMonth");
const statAvg = document.querySelector("#statAvg");
const statHotspots = document.querySelector("#statHotspots");

let map;
let layer;
let reports = [];

function publicAddress(address) {
  function normalizeStreet(address) {
  let street = String(address || "")
    .trim()
    .replace(
      /\s*\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?\s*$/,
      ""
    )
    .replace(/[,;].*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!street) {
    return "Ahlener Osten";
  }

  street = street
    .replace(/\bstr\.?$/i, "straße")
    .replace(/\bstrasse$/i, "straße");

  return street;
}
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
    .replace(/^Jägerstr\.?$/i, "Jägerstraße");

  return normalized || "Ahlener Osten";
}
if (mapEl && window.L) {
  map = L.map(mapEl).setView([51.762, 7.91], 13);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "© OpenStreetMap-Mitwirkende"
    }
  ).addTo(map);

  layer = L.layerGroup().addTo(map);
}

loadReports();

filterEl?.addEventListener("change", renderMap);

async function loadReports() {
  const { data, error } = await supabase
  .from("reports_public")
  .select("*")
  .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    if (latestEl) {
      latestEl.innerHTML = `
        <div class="emptyState">
          Meldungen konnten nicht geladen werden.
        </div>
      `;
    }

    return;
  }

reports = data || [];

renderStats();
renderHotspots();
renderMap();
}

function renderStats() {
  if (!statTotal) {
    return;
  }

  statTotal.textContent = reports.length;

  const now = new Date();

  const monthReports = reports.filter(report => {
    const date = new Date(report.created_at);

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });

  if (statMonth) {
    statMonth.textContent = monthReports.length;
  }

  const severityValues = reports
    .map(report => Number(report.severity))
    .filter(Boolean);

  if (statAvg) {
    statAvg.textContent = severityValues.length
      ? (
          severityValues.reduce((sum, value) => sum + value, 0) /
          severityValues.length
        ).toFixed(1)
      : "–";
  }

  if (statHotspots) {
    statHotspots.textContent = reports.filter(
      report => Number(report.severity) >= 4
    ).length;
  }
}

function renderHotspots() {
  if (!publicHotspotsEl) {
    return;
  }

  const streets = new Map();

  reports.forEach(report => {
    const street = normalizeStreet(report.address);
    const severity = Number(report.severity) || 0;

    if (!streets.has(street)) {
      streets.set(street, {
        count: 0,
        severityTotal: 0
      });
    }

    const entry = streets.get(street);
    entry.count += 1;
    entry.severityTotal += severity;
  });

  const hotspots = [...streets.entries()]
    .map(([street, values]) => ({
      street,
      count: values.count,
      average: values.count
        ? values.severityTotal / values.count
        : 0
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return b.average - a.average;
    })
    .slice(0, 5);

  if (!hotspots.length) {
    publicHotspotsEl.innerHTML = `
      <div class="emptyState">
        Noch keine freigegebenen Meldungen vorhanden.
      </div>
    `;

    return;
  }

  publicHotspotsEl.innerHTML = hotspots
    .map((hotspot, index) => {
      const severityClass = Math.max(
        1,
        Math.min(5, Math.round(hotspot.average || 1))
      );

      const label =
        hotspot.count === 1 ? "Meldung" : "Meldungen";

      return `
        <article class="latestItem">
          <span class="dot s${severityClass}"></span>

          <div>
            <strong>
              ${index + 1}. ${escapeHtml(hotspot.street)}
            </strong>
            <br>
            <small>
              Ø Belastung ${hotspot.average.toFixed(1)}/5
            </small>
          </div>

          <strong>
            ${hotspot.count} ${label}
          </strong>
        </article>
      `;
    })
    .join("");
}

  const latest = reports.slice(0, 5);

  if (!latest.length) {
    latestEl.innerHTML = `
      <div class="emptyState">
        Noch keine freigegebenen Meldungen vorhanden.
      </div>
    `;

    return;
  }

  latestEl.innerHTML = latest
    .map(report => {
      const severity = report.severity || 3;

      return `
        <article class="latestItem">
          <span class="dot s${escapeHtml(severity)}"></span>

          <div>
            <strong>
              ${escapeHtml(publicAddress(report.address))}
            </strong>
            <br>
            <small>${formatDate(report.created_at)}</small>
          </div>

          <small>${escapeHtml(severity)}/5</small>
        </article>
      `;
    })
    .join("");
}

function renderMap() {
  if (!map || !layer) {
    return;
  }

  layer.clearLayers();

  const filter = filterEl?.value || "all";

  let shown = reports.filter(
    report => report.lat && report.lng
  );

  if (filter === "4plus") {
    shown = shown.filter(
      report => Number(report.severity) >= 4
    );
  } else if (filter !== "all") {
    shown = shown.filter(
      report => String(report.severity) === filter
    );
  }

  for (const report of shown) {
    const severity = Number(report.severity) || 3;

    L.circleMarker(
      [report.lat, report.lng],
      {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: color(severity),
        fillOpacity: 0.95
      }
    )
      .bindPopup(`
        <strong>
          📍 ${escapeHtml(publicAddress(report.address))}
        </strong>
        <br>
        🪰 Belastung: ${escapeHtml(severity)}/5
        <br>
        📅 ${formatDate(report.created_at)}
      `)
      .addTo(layer);
  }
}

function color(severity) {
  if (severity === 1) return "#2e7d32";
  if (severity === 2) return "#79bf5b";
  if (severity === 3) return "#f2b705";
  if (severity === 4) return "#ef7d00";

  return "#d51f28";
}
