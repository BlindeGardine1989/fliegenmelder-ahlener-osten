import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const periodFilter = document.querySelector("#analysisPeriod");
const severityFilter = document.querySelector("#analysisSeverity");

const totalElement = document.querySelector("#analysisTotal");
const streetsElement = document.querySelector("#analysisStreets");
const averageElement = document.querySelector("#analysisAverage");
const strongElement = document.querySelector("#analysisStrong");
const updatedElement = document.querySelector("#analysisUpdated");

const monthlyCountChart = document.querySelector("#monthlyCountChart");
const monthlyAverageChart = document.querySelector("#monthlyAverageChart");
const hotspotRanking = document.querySelector("#hotspotRanking");
const situationSummary = document.querySelector("#situationSummary");

let allReports = [];
let isLoading = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    .replace(/^Bergstrasse\.?$/i, "Bergstraße")
    .replace(/^Jägerstr\.?$/i, "Jägerstraße")
    .replace(/^Jaegerstr\.?$/i, "Jägerstraße")
    .replace(/^Jägerstrasse\.?$/i, "Jägerstraße")
    .replace(/\bstr\.?$/i, "straße")
    .replace(/\bstrasse$/i, "straße");

  return street || "Ahlener Osten";
}

function validDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function normalizedSeverity(report) {
  return Math.max(
    1,
    Math.min(5, Number(report?.severity) || 1)
  );
}

function periodStart(value, referenceDate = new Date()) {
  if (value === "all") {
    return null;
  }

  if (value === "year") {
    return new Date(referenceDate.getFullYear(), 0, 1);
  }

  const days = Number(value);

  if (!Number.isFinite(days)) {
    return null;
  }

  const start = new Date(referenceDate);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return start;
}

function applyPeriod(reports, periodValue, referenceDate = new Date()) {
  const start = periodStart(periodValue, referenceDate);

  if (!start) {
    return reports;
  }

  return reports.filter(report => {
    const date = validDate(report.created_at);

    return date && date >= start && date <= referenceDate;
  });
}

function applySeverity(reports, value) {
  if (value === "4plus") {
    return reports.filter(
      report => normalizedSeverity(report) >= 4
    );
  }

  if (value !== "all") {
    return reports.filter(
      report => String(normalizedSeverity(report)) === value
    );
  }

  return reports;
}

function selectedReports(referenceDate = new Date()) {
  const byPeriod = applyPeriod(
    allReports,
    periodFilter?.value || "30",
    referenceDate
  );

  return applySeverity(
    byPeriod,
    severityFilter?.value || "all"
  );
}

function previousPeriodReports(referenceDate = new Date()) {
  const value = periodFilter?.value || "30";

  if (value === "all" || value === "year") {
    return [];
  }

  const days = Number(value);

  if (!Number.isFinite(days)) {
    return [];
  }

  const currentStart = periodStart(value, referenceDate);
  const previousEnd = new Date(currentStart);
  previousEnd.setMilliseconds(-1);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const previous = allReports.filter(report => {
    const date = validDate(report.created_at);

    return (
      date &&
      date >= previousStart &&
      date <= previousEnd
    );
  });

  return applySeverity(
    previous,
    severityFilter?.value || "all"
  );
}

function formatAverage(value) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function monthKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0")
  ].join("-");
}

function lastTwelveMonths() {
  const months = [];
  const now = new Date();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    months.push({
      key: monthKey(date),
      label: date.toLocaleDateString("de-DE", {
        month: "short"
      }).replace(".", ""),
      fullLabel: date.toLocaleDateString("de-DE", {
        month: "long",
        year: "numeric"
      })
    });
  }

  return months;
}

function monthlyData(reports) {
  const months = lastTwelveMonths();

  const data = new Map(
    months.map(month => [
      month.key,
      {
        ...month,
        count: 0,
        severityTotal: 0,
        severityCount: 0
      }
    ])
  );

  reports.forEach(report => {
    const date = validDate(report.created_at);

    if (!date) {
      return;
    }

    const entry = data.get(monthKey(date));

    if (!entry) {
      return;
    }

    entry.count += 1;
    entry.severityTotal += normalizedSeverity(report);
    entry.severityCount += 1;
  });

  return [...data.values()].map(entry => ({
    ...entry,
    average: entry.severityCount
      ? entry.severityTotal / entry.severityCount
      : null
  }));
}

function renderStats(reports) {
  const streetSet = new Set(
    reports
      .map(report => normalizeStreet(report.address))
      .filter(street => street !== "Ahlener Osten")
  );

  const severityValues = reports.map(normalizedSeverity);

  const average = severityValues.length
    ? severityValues.reduce(
        (sum, value) => sum + value,
        0
      ) / severityValues.length
    : null;

  const strong = severityValues.filter(
    value => value >= 4
  ).length;

  totalElement.textContent = String(reports.length);
  streetsElement.textContent = String(streetSet.size);
  averageElement.textContent = average === null
    ? "–"
    : `${formatAverage(average)} / 5`;
  strongElement.textContent = String(strong);
}

function renderMonthlyCounts(reports) {
  const months = monthlyData(reports);
  const max = Math.max(
    1,
    ...months.map(month => month.count)
  );

  monthlyCountChart.innerHTML = months
    .map(month => {
      const height = month.count
        ? Math.max(4, month.count / max * 100)
        : 2;

      return `
        <div
          class="monthlyColumn"
          title="${escapeHtml(month.fullLabel)}: ${month.count} Meldungen"
        >
          <div class="monthlyBarWrap">
            <span
              class="monthlyBar"
              style="height:${height}%"
              aria-hidden="true"
            ></span>
          </div>
          <span class="monthlyValue">${month.count}</span>
          <span class="monthlyLabel">${escapeHtml(month.label)}</span>
        </div>
      `;
    })
    .join("");
}

function renderMonthlyAverage(reports) {
  const months = monthlyData(reports);
  const width = 780;
  const height = 300;
  const paddingLeft = 48;
  const paddingRight = 24;
  const paddingTop = 28;
  const paddingBottom = 50;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const points = months.map((month, index) => {
    const x = paddingLeft +
      index * (plotWidth / Math.max(1, months.length - 1));

    const value = month.average;
    const y = value === null
      ? null
      : paddingTop + (5 - value) / 4 * plotHeight;

    return {
      ...month,
      x,
      y
    };
  });

  const pathParts = [];
  let segmentOpen = false;

  points.forEach(point => {
    if (point.y === null) {
      segmentOpen = false;
      return;
    }

    pathParts.push(
      `${segmentOpen ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    );

    segmentOpen = true;
  });

  const gridLines = [1, 2, 3, 4, 5]
    .map(value => {
      const y = paddingTop + (5 - value) / 4 * plotHeight;

      return `
        <line
          x1="${paddingLeft}"
          y1="${y}"
          x2="${width - paddingRight}"
          y2="${y}"
          stroke="#dfe9df"
          stroke-width="1"
        />
        <text
          x="${paddingLeft - 14}"
          y="${y + 4}"
          text-anchor="end"
          fill="#627064"
          font-size="12"
        >${value}</text>
      `;
    })
    .join("");

  const monthLabels = points
    .map(point => `
      <text
        x="${point.x}"
        y="${height - 18}"
        text-anchor="middle"
        fill="#627064"
        font-size="11"
        font-weight="700"
      >${escapeHtml(point.label)}</text>
    `)
    .join("");

  const circles = points
    .filter(point => point.y !== null)
    .map(point => `
      <circle
        cx="${point.x}"
        cy="${point.y}"
        r="5"
        fill="#2f8128"
        stroke="#ffffff"
        stroke-width="3"
      >
        <title>${escapeHtml(point.fullLabel)}: ${formatAverage(point.average)} / 5</title>
      </circle>
    `)
    .join("");

  const hasValues = points.some(point => point.y !== null);

  monthlyAverageChart.innerHTML = hasValues
    ? `
      <svg
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="Durchschnittliche Belastung pro Monat"
      >
        ${gridLines}
        <path
          d="${pathParts.join(" ")}"
          fill="none"
          stroke="#2f8128"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        ${circles}
        ${monthLabels}
      </svg>
    `
    : `
      <div class="emptyAnalysis">
        Für diesen Zeitraum liegen keine auswertbaren Monatswerte vor.
      </div>
    `;
}

function hotspotData(reports) {
  const streets = new Map();

  reports.forEach(report => {
    const street = normalizeStreet(report.address);

    if (!streets.has(street)) {
      streets.set(street, {
        street,
        count: 0,
        severityTotal: 0
      });
    }

    const entry = streets.get(street);
    entry.count += 1;
    entry.severityTotal += normalizedSeverity(report);
  });

  return [...streets.values()]
    .map(entry => ({
      ...entry,
      average: entry.severityTotal / entry.count
    }))
    .sort((first, second) => {
      if (second.count !== first.count) {
        return second.count - first.count;
      }

      return second.average - first.average;
    })
    .slice(0, 10);
}

function renderHotspots(reports) {
  const hotspots = hotspotData(reports);

  if (!hotspots.length) {
    hotspotRanking.innerHTML = `
      <div class="emptyAnalysis">
        Für diese Auswahl liegen keine Hotspots vor.
      </div>
    `;
    return;
  }

  const maxCount = Math.max(
    1,
    ...hotspots.map(item => item.count)
  );

  hotspotRanking.innerHTML = hotspots
    .map((item, index) => `
      <article class="hotspotItem">
        <div class="hotspotHead">
          <div>
            <span class="hotspotRank">#${index + 1}</span>
            <strong>${escapeHtml(item.street)}</strong>
          </div>

          <div class="hotspotMeta">
            ${item.count} ${item.count === 1 ? "Meldung" : "Meldungen"}
            <br>
            Ø ${formatAverage(item.average)} / 5
          </div>
        </div>

        <div class="hotspotBar" aria-hidden="true">
          <span style="width:${item.count / maxCount * 100}%"></span>
        </div>
      </article>
    `)
    .join("");
}

function trendDescription(currentCount, previousCount) {
  if (!previousCount && !currentCount) {
    return {
      label: "Keine Veränderung",
      text: "Im aktuellen und im vorherigen Vergleichszeitraum liegen keine Meldungen vor."
    };
  }

  if (!previousCount) {
    return {
      label: "Neu aufgetreten",
      text: "Im vorherigen Vergleichszeitraum lagen keine entsprechenden Meldungen vor."
    };
  }

  const change = (currentCount - previousCount) / previousCount * 100;
  const absoluteChange = Math.abs(change);

  if (absoluteChange < 10) {
    return {
      label: "Weitgehend gleichbleibend",
      text: `Die Zahl der Meldungen liegt ungefähr auf dem Niveau des vorherigen Zeitraums (${change >= 0 ? "+" : "−"}${Math.round(absoluteChange)} %).`
    };
  }

  if (change > 0) {
    return {
      label: "Zunahme",
      text: `Gegenüber dem vorherigen Zeitraum ist die Zahl der Meldungen um rund ${Math.round(change)} % gestiegen.`
    };
  }

  return {
    label: "Rückgang",
    text: `Gegenüber dem vorherigen Zeitraum ist die Zahl der Meldungen um rund ${Math.round(absoluteChange)} % gesunken.`
  };
}

function renderSummary(reports) {
  if (!reports.length) {
    situationSummary.innerHTML = `
      <p>
        Für die gewählte Kombination aus Zeitraum und Belastung liegen
        keine freigegebenen Meldungen vor.
      </p>
    `;
    return;
  }

  const streets = new Set(
    reports.map(report => normalizeStreet(report.address))
  );

  const severityValues = reports.map(normalizedSeverity);
  const average = severityValues.reduce(
    (sum, value) => sum + value,
    0
  ) / severityValues.length;

  const hotspots = hotspotData(reports);
  const topStreet = hotspots[0]?.street || "keinem eindeutigen Schwerpunkt";

  const previous = previousPeriodReports();
  const comparison = trendDescription(
    reports.length,
    previous.length
  );

  const today = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const comparisonText =
    (periodFilter?.value === "all" || periodFilter?.value === "year")
      ? ""
      : `<p>${escapeHtml(comparison.text)}</p>`;

  const comparisonBadge =
    (periodFilter?.value === "all" || periodFilter?.value === "year")
      ? ""
      : `
        <span class="comparisonBadge">
          📈 ${escapeHtml(comparison.label)}
        </span>
      `;

  situationSummary.innerHTML = `
    <p><strong>Stand ${today}</strong></p>

    <p>
      Im ausgewählten Zeitraum wurden
      <strong>${reports.length} ${reports.length === 1 ? "Meldung" : "Meldungen"}</strong>
      aus <strong>${streets.size} ${streets.size === 1 ? "Straße" : "Straßen"}</strong>
      erfasst. Die durchschnittliche Belastung beträgt
      <strong>${formatAverage(average)} von 5 Punkten</strong>.
      Die meisten Meldungen stammen aus der
      <strong>${escapeHtml(topStreet)}</strong>.
    </p>

    ${comparisonText}
    ${comparisonBadge}
  `;
}

function renderAnalysis() {
  const reports = selectedReports();

  renderStats(reports);
  renderMonthlyCounts(reports);
  renderMonthlyAverage(reports);
  renderHotspots(reports);
  renderSummary(reports);

  updatedElement.textContent =
    `Stand: ${new Date().toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short"
    })}`;
}

async function loadReports() {
  if (isLoading) {
    return;
  }

  isLoading = true;

  try {
    const { data, error } = await supabase
      .from("reports_public")
      .select("id, address, severity, created_at")
      .order("created_at", {
        ascending: true
      });

    if (error) {
      console.error(
        "Auswertungsdaten konnten nicht geladen werden:",
        error
      );

      updatedElement.textContent =
        "Die Auswertungsdaten konnten nicht geladen werden.";

      situationSummary.innerHTML = `
        <p>
          Die freigegebenen Meldungen konnten momentan nicht geladen werden.
        </p>
      `;
      return;
    }

    allReports = data || [];
    renderAnalysis();
  } finally {
    isLoading = false;
  }
}

periodFilter?.addEventListener("change", renderAnalysis);
severityFilter?.addEventListener("change", renderAnalysis);

window.addEventListener("focus", loadReports);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadReports();
  }
});

window.setInterval(loadReports, 60000);

loadReports();
