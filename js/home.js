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
   Fliegenampel
   ========================================================= */

const trafficLight = document.querySelector("#flyTrafficLight");
const trafficLightLabel = document.querySelector("#flyTrafficLightLabel");
const trafficLightTrend = document.querySelector("#flyTrafficLightTrend");
const trafficLightText = document.querySelector("#flyTrafficLightText");
const trafficLightDetails = document.querySelector("#flyTrafficLightDetails");
const trafficLightUpdated = document.querySelector("#flyTrafficLightUpdated");

function reportsBetween(start, end) {
  return reports.filter(report => {
    const timestamp = new Date(report.created_at).getTime();

    return (
      Number.isFinite(timestamp) &&
      timestamp >= start &&
      timestamp <= end
    );
  });
}

function trafficLightMetrics(selectedReports) {
  const severities = selectedReports
    .map(report => Number(report.severity))
    .filter(value => Number.isFinite(value));

  const average = severities.length
    ? severities.reduce((sum, value) => sum + value, 0) /
      severities.length
    : 0;

  const strongCount = severities.filter(
    value => value >= 4
  ).length;

  const strongShare = severities.length
    ? strongCount / severities.length
    : 0;

  const streets = new Set(
    selectedReports.map(report => normalizeStreet(report.address))
  ).size;

  return {
    count: selectedReports.length,
    average,
    strongCount,
    strongShare,
    streets
  };
}

function calculateTrafficLight() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const currentReports = reportsBetween(
    now - 14 * day,
    now
  );

  const previousReports = reportsBetween(
    now - 28 * day,
    now - 14 * day
  );

  const current = trafficLightMetrics(currentReports);
  const previous = trafficLightMetrics(previousReports);

  if (current.count === 0) {
    return {
      level: "none",
      label: "Keine aktuelle Einstufung",
      text: "In den vergangenen 14 Tagen liegen keine freigegebenen Meldungen vor.",
      details: "Grundlage: freigegebene Meldungen der letzten 14 Tage",
      metrics: [],
      trendLabel: "➖ keine Daten"
    };
  }

  /*
   * Die durchschnittliche gemeldete Belastung ist die Hauptgrundlage.
   * Ein hoher Anteil starker Meldungen kann die Ampel um eine Stufe anheben.
   */
  let levelIndex = 0;

  if (current.average >= 4.15) {
    levelIndex = 3;
  } else if (current.average >= 3.35) {
    levelIndex = 2;
  } else if (current.average >= 2.35) {
    levelIndex = 1;
  }

  if (
    current.strongShare >= 0.7 &&
    levelIndex < 3
  ) {
    levelIndex += 1;
  }

  const configurations = [
    {
      level: "green",
      label: "Geringe Belastung",
      text: "Die aktuell gemeldete Fliegenbelastung ist gering."
    },
    {
      level: "yellow",
      label: "Erhöhte Belastung",
      text: "Derzeit wird eine erhöhte Fliegenbelastung gemeldet."
    },
    {
      level: "orange",
      label: "Hohe Belastung",
      text: "Derzeit wird aus mehreren Meldungen eine hohe Belastung sichtbar."
    },
    {
      level: "red",
      label: "Sehr hohe Belastung",
      text: "Derzeit wird eine sehr hohe Fliegenbelastung gemeldet."
    }
  ];

  let trendLabel = "➖ stabil";

  if (previous.count === 0) {
    trendLabel = "● neuer Vergleich";
  } else {
    const change =
      (current.count - previous.count) / previous.count;

    if (change >= 0.2) {
      trendLabel = "↗ steigend";
    } else if (change <= -0.2) {
      trendLabel = "↘ rückläufig";
    }
  }

  const configuration = configurations[levelIndex];

  return {
    ...configuration,
    trendLabel,
    metrics: [
      `${current.count} ${current.count === 1 ? "Meldung" : "Meldungen"} · letzte 14 Tage`,
      `${current.streets} ${current.streets === 1 ? "Straße" : "Straßen"}`,
      `Ø ${current.average.toFixed(1).replace(".", ",")}/5`,
      `${current.strongCount} stark / sehr stark`
    ]
  };
}

function renderTrafficLight(loadError = false) {
  if (
    !trafficLight ||
    !trafficLightLabel ||
    !trafficLightTrend ||
    !trafficLightText ||
    !trafficLightDetails ||
    !trafficLightUpdated
  ) {
    return;
  }

  trafficLight.classList.remove(
    "is-green",
    "is-yellow",
    "is-orange",
    "is-red",
    "is-none"
  );

  if (loadError) {
    trafficLight.classList.add("is-none");
    trafficLightLabel.textContent =
      "Aktuelle Einstufung nicht verfügbar";
    trafficLightTrend.textContent = "⚠ nicht verfügbar";
    trafficLightText.textContent =
      "Die freigegebenen Meldungen konnten gerade nicht geladen werden.";
    trafficLightDetails.textContent = "";
    trafficLightUpdated.textContent = "";
    return;
  }

  const status = calculateTrafficLight();

  trafficLight.classList.add(`is-${status.level}`);
  trafficLightLabel.textContent = status.label;
  trafficLightTrend.textContent = status.trendLabel;
  trafficLightText.textContent = status.text;

  if (status.metrics) {
    trafficLightDetails.innerHTML = status.metrics
      .map(metric => `
        <span class="flyTrafficLight__metric">
          ${escapeHtml(metric)}
        </span>
      `)
      .join("");
  } else {
    trafficLightDetails.textContent = status.details;
  }

  trafficLightUpdated.textContent =
    `Stand der Auswertung: ${new Date().toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short"
    })}`;
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

      renderTrafficLight(true);
      return;
    }

    reports = data || [];

    renderStatistics();
    renderTrafficLight();
    renderHotspots();
    renderMap();
  } finally {
    isLoadingReports = false;
  }
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

/* =========================================================
   Start
   ========================================================= */

loadReports();

/* Erfolgsbestätigung nach einer eingereichten Meldung */
function showReportSuccessMessage() {
  const params = new URLSearchParams(window.location.search);
  const message = sessionStorage.getItem("reportSuccess");

  if (params.get("meldung") !== "erfolgreich" || !message) {
    return;
  }

  const main = document.querySelector("main");
  if (!main) {
    return;
  }

  const notice = document.createElement("div");
  notice.className = "reportSuccessNotice";
  notice.setAttribute("role", "status");
  notice.innerHTML = `<strong>✅ Meldung eingereicht</strong><span>${escapeHtml(message)}</span>`;
  main.prepend(notice);

  sessionStorage.removeItem("reportSuccess");
  window.history.replaceState({}, document.title, "index.html");
}

showReportSuccessMessage();
