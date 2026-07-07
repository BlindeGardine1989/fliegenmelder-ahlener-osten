
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBox = document.querySelector("#loginBox");
const adminPanel = document.querySelector("#adminPanel");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const loginStatus = document.querySelector("#loginStatus");
const logoutButton = document.querySelector("#logoutButton");

const status = document.querySelector("#adminStatus");
const list = document.querySelector("#adminList");
const exportButton = document.querySelector("#exportCsv");
const searchInput = document.querySelector("#adminSearch");
const filterSelect = document.querySelector("#adminFilter");

const statTotal = document.querySelector("#statTotal");
const statApproved = document.querySelector("#statApproved");
const statPending = document.querySelector("#statPending");
const statAvg = document.querySelector("#statAvg");

let allReports = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "–";
  return new Date(value).toLocaleString("de-DE");
}

function statusLabel(value) {
  if (value === "approved") return "Freigegeben";
  if (value === "hidden") return "Ausgeblendet";
  return "In Prüfung";
}

function hasCoords(report) {
  return report.lat !== null &&
    report.lat !== undefined &&
    report.lng !== null &&
    report.lng !== undefined &&
    String(report.lat).trim() !== "" &&
    String(report.lng).trim() !== "";
}

async function checkSession() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    loginBox.hidden = true;
    adminPanel.hidden = false;
    await loadReports();
  } else {
    loginBox.hidden = false;
    adminPanel.hidden = true;
  }
}

loginButton?.addEventListener("click", async () => {
  loginStatus.textContent = "Login wird geprüft ...";

  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value
  });

  if (error) {
    console.error(error);
    loginStatus.textContent = "Login fehlgeschlagen.";
    return;
  }

  loginPassword.value = "";
  loginStatus.textContent = "";
  await checkSession();
});

forgotPasswordButton?.addEventListener("click", async () => {
  const email = loginEmail.value.trim();

  if (!email) {
    loginStatus.textContent = "Bitte zuerst die E-Mail-Adresse eintragen.";
    return;
  }

  loginStatus.textContent = "E-Mail zum Zurücksetzen wird gesendet ...";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://fliegenmelder-ahlener-osten.pages.dev/reset-password.html"
  });

  if (error) {
    console.error(error);
    loginStatus.textContent = "E-Mail konnte nicht gesendet werden.";
    return;
  }

  loginStatus.textContent = "E-Mail wurde gesendet. Bitte Postfach prüfen.";
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await checkSession();
});

searchInput?.addEventListener("input", renderCurrentView);
filterSelect?.addEventListener("change", renderCurrentView);

async function loadReports() {
  status.textContent = "Meldungen werden geladen ...";

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    status.textContent = "Meldungen konnten nicht geladen werden.";
    return;
  }

  allReports = data || [];
  updateStats(allReports);
  renderCurrentView();
}

function updateStats(reports) {
  const total = reports.length;
  const approved = reports.filter(r => r.visible === true || r.status === "approved").length;
  const pending = reports.filter(r => !r.visible && (r.status || "pending") === "pending").length;
  const severityValues = reports.map(r => Number(r.severity)).filter(Number.isFinite);
  const avg = severityValues.length
    ? (severityValues.reduce((a, b) => a + b, 0) / severityValues.length).toFixed(1)
    : "0";

  statTotal.textContent = total;
  statApproved.textContent = approved;
  statPending.textContent = pending;
  statAvg.textContent = avg;
}

function getFilteredReports() {
  const search = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterSelect?.value || "all";

  return allReports.filter(report => {
    const reportStatus = report.status || "pending";
    if (filter !== "all" && reportStatus !== filter) return false;
    if (!search) return true;

    return [
      report.address,
      report.note,
      report.contact_private,
      report.since,
      report.time_of_day,
      report.status
    ].join(" ").toLowerCase().includes(search);
  });
}

function renderCurrentView() {
  renderReports(getFilteredReports());
}

function severityBar(value) {
  const number = Number(value);
  const count = Number.isFinite(number) ? Math.max(0, Math.min(5, number)) : 0;
  return "●".repeat(count) + "○".repeat(5 - count);
}

function mapsUrl(report) {
  const query = encodeURIComponent(`${report.address || ""} Ahlen`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

async function geocodeAddress(report) {
  const address = `${report.address || ""}, Ahlen, Nordrhein-Westfalen, Deutschland`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;

  const response = await fetch(url, { headers: { "Accept": "application/json" } });

  if (!response.ok) throw new Error("Geocoding fehlgeschlagen.");

  const results = await response.json();
  if (!results || !results.length) throw new Error("Adresse nicht gefunden.");

  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon)
  };
}

function renderReports(reports) {
  list.innerHTML = "";

  if (!reports.length) {
    list.innerHTML = `<article class="adminCard"><p>Keine passenden Meldungen vorhanden.</p></article>`;
    status.textContent = "Keine passenden Meldungen vorhanden.";
    return;
  }

  status.textContent = `${reports.length} Meldung(en) angezeigt.`;

  reports.forEach(report => {
    const id = report.id;
    const title = report.public_id || report.id || "Meldung";
    const reportStatus = report.status || "pending";
    const coordsAvailable = hasCoords(report);

    const card = document.createElement("article");
    card.className = `adminCard status-${reportStatus}`;

    card.innerHTML = `
      <div class="adminCardHead">
        <div>
          <p class="eyebrow">${statusLabel(reportStatus)}</p>
          <h2>Meldung ${escapeHtml(String(title).slice(0, 8))}</h2>
        </div>
        <span class="statusBadge ${reportStatus}">${escapeHtml(statusLabel(reportStatus))}</span>
      </div>

      <p>
        <strong>Sichtbar:</strong> ${report.visible ? "ja" : "nein"}<br>
        <strong>Datum:</strong> ${formatDate(report.created_at)}<br>
        <strong>Straße/Hausnummer:</strong> ${escapeHtml(report.address || "–")}<br>
        <strong>Belastung:</strong> ${escapeHtml(report.severity || "–")}/5
        <span class="severityBar">${severityBar(report.severity)}</span><br>
        <strong>Seit:</strong> ${escapeHtml(report.since || "–")}<br>
        <strong>Tageszeit:</strong> ${escapeHtml(report.time_of_day || "–")}
      </p>

      <p><strong>Bemerkung:</strong><br>${escapeHtml(report.note || "–")}</p>
      <p><strong>Kontakt intern:</strong><br>${escapeHtml(report.contact_private || "–")}</p>

      <div class="coordBox">
        <p><strong>Kartenposition:</strong> ${coordsAvailable ? "Koordinaten vorhanden." : "Noch keine Koordinaten gespeichert – ohne Koordinaten erscheint kein Pin auf der Karte."}</p>

        <div class="coordGrid">
          <label>Breitengrad lat
            <input type="number" step="any" inputmode="decimal" value="${escapeHtml(report.lat ?? "")}" data-lat="${id}">
          </label>
          <label>Längengrad lng
            <input type="number" step="any" inputmode="decimal" value="${escapeHtml(report.lng ?? "")}" data-lng="${id}">
          </label>
        </div>

        <div class="adminControls">
          <button class="button" data-action="autoCoords" data-id="${id}">Koordinaten aus Adresse holen</button>
          <a class="button secondary" href="${mapsUrl(report)}" target="_blank" rel="noopener">In Google Maps prüfen</a>
          <button class="button secondary" data-action="saveCoords" data-id="${id}">Koordinaten speichern</button>
        </div>
      </div>

      <div class="adminControls">
        <button class="button" data-action="approve" data-id="${id}">Freigeben</button>
        <button class="button secondary" data-action="pending" data-id="${id}">Zurück auf Prüfung</button>
        <button class="button danger" data-action="hide" data-id="${id}">Ausblenden</button>
        <button class="button danger" data-action="delete" data-id="${id}">Löschen</button>
      </div>
    `;

    list.appendChild(card);
  });

  list.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", () => handleAction(button));
  });
}

async function handleAction(button) {
  const id = button.dataset.id;
  const action = button.dataset.action;
  const report = allReports.find(r => String(r.id) === String(id));

  if (action === "autoCoords") {
    if (!report?.address) {
      alert("Keine Adresse vorhanden.");
      return;
    }

    try {
      status.textContent = "Koordinaten werden ermittelt ...";

      const coords = await geocodeAddress(report);

      const { error } = await supabase
        .from("reports")
        .update({ lat: coords.lat, lng: coords.lng })
        .eq("id", id);

      if (error) throw error;

      status.textContent = `Koordinaten gespeichert: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
      await loadReports();
    } catch (error) {
      console.error(error);
      alert("Koordinaten konnten nicht automatisch ermittelt werden. Bitte Adresse prüfen oder manuell eintragen.");
    }

    return;
  }

  if (action === "saveCoords") {
    const latInput = list.querySelector(`input[data-lat="${CSS.escape(id)}"]`);
    const lngInput = list.querySelector(`input[data-lng="${CSS.escape(id)}"]`);

    const lat = Number(String(latInput?.value || "").replace(",", "."));
    const lng = Number(String(lngInput?.value || "").replace(",", "."));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("Bitte gültige Zahlen für lat und lng eintragen.");
      return;
    }

    const { error } = await supabase
      .from("reports")
      .update({ lat, lng })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Koordinaten konnten nicht gespeichert werden.");
      return;
    }

    status.textContent = "Koordinaten gespeichert.";
    await loadReports();
    return;
  }

  if (action === "delete") {
    if (!confirm("Diese Meldung wirklich löschen?")) return;

    const { error } = await supabase.from("reports").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("Löschen nicht möglich.");
      return;
    }

    await loadReports();
    return;
  }

  let patch = { status: "pending", visible: false };

  if (action === "approve") patch = { status: "approved", visible: true };
  if (action === "hide") patch = { status: "hidden", visible: false };

  const { error } = await supabase.from("reports").update(patch).eq("id", id);

  if (error) {
    console.error(error);
    alert("Änderung nicht möglich.");
    return;
  }

  await loadReports();
}

exportButton?.addEventListener("click", () => {
  const rows = getFilteredReports();

  const header = [
    "Datum","Status","Sichtbar","Ort","Belastung","Seit","Tageszeit","Bemerkung","Kontakt","Lat","Lng"
  ];

  const csv = [
    header.join(";"),
    ...rows.map(r => [
      formatDate(r.created_at),
      r.status || "",
      r.visible ? "ja" : "nein",
      r.address || "",
      r.severity || "",
      r.since || "",
      r.time_of_day || "",
      r.note || "",
      r.contact_private || "",
      r.lat || "",
      r.lng || ""
    ].map(value => `"${String(value).replaceAll('"', '""')}"`).join(";"))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fliegenmelder-meldungen.csv";
  a.click();
  URL.revokeObjectURL(url);
});

checkSession();
