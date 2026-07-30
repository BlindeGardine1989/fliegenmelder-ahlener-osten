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
let isLoadingReports = false;


/* =========================================================
   Statusanzeige vorbereiten
   ========================================================= */

function ensureStatusStyles() {
  if (document.querySelector("#flyStatusStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "flyStatusStyles";

  style.textContent = `
    .flyStatus {
      margin: 0 0 18px;
      padding: 18px 20px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-left: 7px solid var(--fly-status-color, #6b7280);
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 7px 22px rgba(0, 0, 0, 0.07);
    }

    .flyStatus__top {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .flyStatus__light {
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      border-radius: 50%;
      background: var(--fly-status-color, #6b7280);
      box-shadow: 0 0 0 5px var(--fly-status-glow, rgba(107, 114, 128, 0.15));
    }

    .flyStatus__title {
      margin: 0;
      font-size: 1.05rem;
      line-height: 1.35;
    }

    .flyStatus__value {
      color: var(--fly-status-color, #6b7280);
    }

    .flyStatus__text {
      margin: 8px 0 0 30px;
      color: #4b5563;
      line-height: 1.5;
    }

    .flyStatus__details {
      margin: 8px 0 0 30px;
      font-size: 0.9rem;
      color: #6b7280;
    }

    @media (max-width: 640px) {
      .flyStatus {
        padding: 16px;
      }

      .flyStatus__text,
      .flyStatus__details {
        margin-left: 0;
      }
    }
  `;

  document.head.appendChild(style);
}


function ensureStatusElement() {
  let statusElement = document.querySelector("#flyStatus");

  if (statusElement) {
    return statusElement;
  }

  statusElement = document.createElement("section");
  statusElement.id = "flyStatus";
  statusElement.className = "flyStatus";
  statusElement.setAttribute("aria-live", "polite");

  /*
   * Der Status wird direkt oberhalb der kleinen Startseitenkarte
   * eingesetzt. Dadurch ist keine Änderung an index.html nötig.
   */
  if (mapElement?.parentElement) {
    mapElement.parentElement.insertBefore(
      statusElement,
      mapElement
    );
  } else if (hotspotList?.parentElement) {
    hotspotList.parentElement.insertBefore(
      statusElement,
      hotspotList
    );
  }

  return statusElement;
}


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
  if (isLoadingReports) {
    return;
  }

  isLoadingReports = true;

  try {
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

      if (hotspotList && reports.length === 0) {
        hotspotList.innerHTML = `
          <div class="emptyState">
            Meldungen konnten nicht geladen werden.
          </div>
        `;
      }

      renderCurrentStatus(true);
      return;
    }

    reports = data || [];

    renderStatistics();
    renderCurrentStatus();
    renderHotspots();
    renderMap();
  } finally {
    isLoadingReports = false;
  }
}


/* =========================================================
   Aktueller Belastungsstatus
   ========================================================= */

function reportsFromLastDays(days) {
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;

  return reports.filter(report => {
    const timestamp = new Date(report.created_at).getTime();

    return (
      Number.isFinite(timestamp) &&
      timestamp >= start &&
      timestamp <= now
    );
  });
}


function calculateCurrentStatus() {
  const recentReports = reportsFromLastDays(14);

  if (recentReports.length === 0) {
    return {
      label: "Keine aktuelle Einstufung",
      color: "#6b7280",
      glow: "rgba(107, 114, 128, 0.16)",
      text: "In den vergangenen 14 Tagen liegen keine freigegebenen Meldungen vor.",
      details: "Grundlage: freigegebene Meldungen der letzten 14 Tage"
    };
  }

  const severityValues = recentReports
    .map(report => Number(report.severity))
    .filter(value => Number.isFinite(value));

  const average = severityValues.length
    ? severityValues.reduce(
        (sum, value) => sum + value,
        0
      ) / severityValues.length
    : 0;

  const strongCount = recentReports.filter(
    report => Number(report.severity) >= 4
  ).length;

  const strongShare = recentReports.length
    ? strongCount / recentReports.length
    : 0;

  /*
   * Einfache, nachvollziehbare Einstufung:
   * Durchschnittliche Belastung ist die Hauptgrundlage.
   * Ein hoher Anteil starker Meldungen hebt die Stufe gegebenenfalls an.
   */
  let level = 1;

  if (average >= 4.25 || strongShare >= 0.75) {
    level = 5;
  } else if (average >= 3.5 || strongShare >= 0.55) {
    level = 4;
  } else if (average >= 2.75 || strongShare >= 0.35) {
    level = 3;
  } else if (average >= 2 || strongShare >= 0.2) {
    level = 2;
  }

  const configurations = {
    1: {
      label: "Gering",
      color: "#2e7d32",
      glow: "rgba(46, 125, 50, 0.18)",
      text: "Die aktuell gemeldete Belastung ist gering."
    },
    2: {
      label: "Erhöht",
      color: "#79a83b",
      glow: "rgba(121, 168, 59, 0.20)",
      text: "Die aktuell gemeldete Belastung ist erhöht."
    },
    3: {
      label: "Deutlich erhöht",
      color: "#d39b00",
      glow: "rgba(211, 155, 0, 0.20)",
      text: "Die aktuell gemeldete Belastung ist deutlich erhöht."
    },
    4: {
      label: "Hoch",
      color: "#ef7d00",
      glow: "rgba(239, 125, 0, 0.20)",
      text: "Die aktuell gemeldete Belastung ist hoch."
    },
    5: {
      label: "Akut",
      color: "#d51f28",
      glow: "rgba(213, 31, 40, 0.20)",
      text: "Die aktuell gemeldete Belastung ist akut."
    }
  };

  const status = configurations[level];

  return {
    ...status,
    details:
      `Grundlage: ${recentReports.length} ${
        recentReports.length === 1 ? "Meldung" : "Meldungen"
      } in den letzten 14 Tagen · Ø Belastung ${
        average.toFixed(1).replace(".", ",")
      }/5`
  };
}


function renderCurrentStatus(loadError = false) {
  ensureStatusStyles();

  const statusElement = ensureStatusElement();

  if (!statusElement) {
    return;
  }

  if (loadError) {
    statusElement.style.setProperty(
      "--fly-status-color",
      "#6b7280"
    );
    statusElement.style.setProperty(
      "--fly-status-glow",
      "rgba(107, 114, 128, 0.16)"
    );

    statusElement.innerHTML = `
      <div class="flyStatus__top">
        <span class="flyStatus__light" aria-hidden="true"></span>
        <h2 class="flyStatus__title">
          Aktuelle Fliegenbelastung:
          <span class="flyStatus__value">
            derzeit nicht verfügbar
          </span>
        </h2>
      </div>

      <p class="flyStatus__text">
        Die aktuellen Meldungen konnten gerade nicht geladen werden.
      </p>
    `;

    return;
  }

  const status = calculateCurrentStatus();

  statusElement.style.setProperty(
    "--fly-status-color",
    status.color
  );
  statusElement.style.setProperty(
    "--fly-status-glow",
    status.glow
  );

  statusElement.innerHTML = `
    <div class="flyStatus__top">
      <span class="flyStatus__light" aria-hidden="true"></span>

      <h2 class="flyStatus__title">
        Aktuelle Fliegenbelastung:
        <span class="flyStatus__value">
          ${escapeHtml(status.label)}
        </span>
      </h2>
    </div>

    <p class="flyStatus__text">
      ${escapeHtml(status.text)}
    </p>

    <p class="flyStatus__details">
      ${escapeHtml(status.details)}
    </p>
  `;
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
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
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

  visibleReports
    .slice()
    .sort((a, b) => {
      return new Date(a.created_at) - new Date(b.created_at);
    })
    .forEach(report => {
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
          📅 ${escapeHtml(formatDate(report.created_at))}
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
   Ereignisse und automatische Aktualisierung
   ========================================================= */

severityFilter?.addEventListener(
  "change",
  renderMap
);

window.addEventListener("focus", loadReports);
window.addEventListener("pageshow", loadReports);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadReports();
  }
});

window.setInterval(loadReports, 30000);


/* =========================================================
   Start
   ========================================================= */

ensureStatusStyles();
ensureStatusElement();
loadReports();
