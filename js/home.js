import {
  supabase,
  escapeHtml,
  formatDate
} from "./app.js";


const mapElement = document.querySelector("#map");
const hotspotList = document.querySelector("#publicHotspots");
const severityFilter = document.querySelector("#severityFilter");

const statTotal = document.querySelector("#statTotal");
const statMonth = document.querySelector("#statMonth");
const statAverage = document.querySelector("#statAvg");
const statStrong = document.querySelector("#statHotspots");


let map = null;
let reportLayer = null;
let reports = [];


/* =========================================================
   Straßennamen für die öffentliche Anzeige vereinheitlichen
   ========================================================= */

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
    .replace(/^Bergstr\.?$/i, "Bergstraße")
    .replace(/^Bergstrasse$/i, "Bergstraße")
    .replace(/^Jägerstr\.?$/i, "Jägerstraße")
    .replace(/^Jägerstrasse$/i, "Jägerstraße")
    .replace(/\bstr\.?$/i, "straße")
    .replace(/\bstrasse$/i, "straße");

  return street || "Ahlener Osten";
}


/* =========================================================
   Karte einrichten
   ========================================================= */

if (mapElement && window.L) {
  map = L.map(mapElement).setView(
    [51.762, 7.91],
    13
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "© OpenStreetMap-Mitwirkende"
    }
  ).addTo(map);

  reportLayer = L.layerGroup().addTo(map);
}


/* =========================================================
   Daten laden
   ========================================================= */

async function loadReports() {
  const { data, error } = await supabase
    .from("reports_public")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(
      "Öffentliche Meldungen konnten nicht geladen werden:",
      error
    );

    if (hotspotList) {
      hotspotList.innerHTML = `
        <div class="emptyState">
          Meldungen konnten nicht geladen werden.
        </div>
      `;
    }

    return;
  }

  reports = data || [];

  renderStatistics();
  renderHotspots();
  renderMap();
}


/* =========================================================
   Statistiken
   ========================================================= */

function renderStatistics() {
  if (statTotal) {
    statTotal.textContent = reports.length;
  }

  const now = new Date();

  const reportsThisMonth = reports.filter(report => {
    const date = new Date(report.created_at);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });

  if (statMonth) {
    statMonth.textContent = reportsThisMonth.length;
  }

  const severityValues = reports
    .map(report => Number(report.severity))
    .filter(value => Number.isFinite(value));

  if (statAverage) {
    statAverage.textContent = severityValues.length
      ? (
          severityValues.reduce(
            (sum, value) => sum + value,
            0
          ) / severityValues.length
        ).toFixed(1)
      : "–";
  }

  if (statStrong) {
    statStrong.textContent = reports.filter(
      report => Number(report.severity) >= 4
    ).length;
  }
}


/* =========================================================
   Öffentliche Hotspots
   ========================================================= */

function renderHotspots() {
  if (!hotspotList) {
    return;
  }

  const streetData = new Map();

  reports.forEach(report => {
    const street = normalizeStreet(report.address);
    const severity = Number(report.severity);

    if (!streetData.has(street)) {
      streetData.set(street, {
        count: 0,
        severityTotal: 0,
        severityCount: 0
      });
    }

    const entry = streetData.get(street);

    entry.count += 1;

    if (Number.isFinite(severity)) {
      entry.severityTotal += severity;
      entry.severityCount += 1;
    }
  });

  const hotspots = [...streetData.entries()]
    .map(([street, values]) => {
      const average = values.severityCount
        ? values.severityTotal / values.severityCount
        : 0;

      return {
        street,
        count: values.count,
        average
      };
    })
    .sort((first, second) => {
      if (second.count !== first.count) {
        return second.count - first.count;
      }

      return second.average - first.average;
    })
    .slice(0, 5);

  if (!hotspots.length) {
    hotspotList.innerHTML = `
      <div class="emptyState">
        Noch keine freigegebenen Meldungen vorhanden.
      </div>
    `;

    return;
  }

  hotspotList.innerHTML = hotspots
    .map((hotspot, index) => {
      const severityClass = Math.max(
        1,
        Math.min(
          5,
          Math.round(hotspot.average || 1)
        )
      );

      const reportLabel =
        hotspot.count === 1
          ? "Meldung"
          : "Meldungen";

      const formattedAverage =
        hotspot.average > 0
          ? hotspot.average.toFixed(1).replace(".", ",")
          : "–";

      return `
        <article class="latestItem">
          <span
            class="dot s${severityClass}"
            aria-hidden="true"
          ></span>

          <div>
            <strong>
              ${index + 1}. ${escapeHtml(hotspot.street)}
            </strong>

            <br>

            <small>
              Ø Belastung ${formattedAverage}/5
            </small>
          </div>

          <strong>
            ${hotspot.count} ${reportLabel}
          </strong>
        </article>
      `;
    })
    .join("");
}


/* =========================================================
   Öffentliche Karte
   ========================================================= */

function renderMap() {
  if (!map || !reportLayer) {
    return;
  }

  reportLayer.clearLayers();

  const selectedFilter =
    severityFilter?.value || "all";

  let visibleReports = reports.filter(report => {
    const lat = Number(report.lat);
    const lng = Number(report.lng);

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    );
  });

  if (selectedFilter === "4plus") {
    visibleReports = visibleReports.filter(
      report => Number(report.severity) >= 4
    );
  } else if (selectedFilter !== "all") {
    visibleReports = visibleReports.filter(
      report =>
        String(report.severity) === selectedFilter
    );
  }

  visibleReports.forEach(report => {
    const latitude = Number(report.lat);
    const longitude = Number(report.lng);
    const severity = Number(report.severity) || 3;
    const street = normalizeStreet(report.address);

    L.circleMarker(
      [latitude, longitude],
      {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: severityColor(severity),
        fillOpacity: 0.95
      }
    )
      .bindPopup(`
        <strong>
          📍 ${escapeHtml(street)}
        </strong>
        <br>
        🪰 Belastung: ${escapeHtml(severity)}/5
        <br>
        📅 ${formatDate(report.created_at)}
      `)
      .addTo(reportLayer);
  });

  window.setTimeout(() => {
    map.invalidateSize();
  }, 200);
}


/* =========================================================
   Farben der Belastungsstufen
   ========================================================= */

function severityColor(severity) {
  if (severity === 1) {
    return "#2e7d32";
  }

  if (severity === 2) {
    return "#79bf5b";
  }

  if (severity === 3) {
    return "#f2b705";
  }

  if (severity === 4) {
    return "#ef7d00";
  }

  return "#d51f28";
}


/* =========================================================
   Ereignisse und Start
   ========================================================= */

severityFilter?.addEventListener(
  "change",
  renderMap
);

loadReports();
