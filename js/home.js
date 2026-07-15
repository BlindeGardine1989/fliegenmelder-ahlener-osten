import { supabase, escapeHtml, formatDate } from "./app.js";

const mapEl = document.querySelector("#map");
const latestEl = document.querySelector("#latestReports");
const filterEl = document.querySelector("#severityFilter");

const statTotal = document.querySelector("#statTotal");
const statMonth = document.querySelector("#statMonth");
const statAvg = document.querySelector("#statAvg");
const statHotspots = document.querySelector("#statHotspots");

let map;
let layer;
let reports = [];

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
  renderLatest();
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

function renderLatest() {
  if (!latestEl) {
    return;
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
