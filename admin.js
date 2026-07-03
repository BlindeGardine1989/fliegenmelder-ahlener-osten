import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBox = document.querySelector("#loginBox");
const adminPanel = document.querySelector("#adminPanel");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
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

  const severities = reports
    .map(r => Number(r.severity))
    .filter(n => Number.isFinite(n));

  const avg = severities.length
    ? (severities.reduce((a, b) => a + b, 0) / severities.length).toFixed(1)
    : "0";

  statTotal.textContent = total;
  statApproved.textContent = approved;
  statPending.textContent = pending;
  statAvg.textContent = avg;
}

function getFilteredReports() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterSelect?.value || "all";

  return allReports.filter(r => {
    const reportStatus = r.status || "pending";

    if (filter !== "all" && reportStatus !== filter) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      r.address,
      r.note,
      r.contact_private,
      r.since,
      r.time_of_day,
      r.status
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

function renderCurrentView() {
  renderReports(getFilteredReports());
}

function severityBar(value) {
  const s = Number(value);
  const filled = Number.isFinite(s) ? Math.max(0, Math.min(5, s)) : 0;
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

function renderReports(reports) {
  list.innerHTML = "";

  if (!reports.length) {
    list.innerHTML = `<article class="adminCard"><p>Keine passenden Meldungen vorhanden.</p></article>`;
    status.textContent = "Keine passenden Meldungen vorhanden.";
    return;
  }

  status.textContent = `${reports.length} Meldung(en) angezeigt.`;

  reports.forEach(r => {
    const id = r.id;
    const title = r.public_id || r.id || "Meldung";
    const currentStatus = r.status || "pending";

    const card = document.createElement("article");
    card.className = `adminCard status-${currentStatus}`;

    card.innerHTML = `
      <div class="adminCardHead">
        <div>
          <p class="eyebrow">${statusLabel(currentStatus)}</p>
          <h2>Meldung ${escapeHtml(String(title).slice(0, 8))}</h2>
        </div>
        <span class="statusBadge ${currentStatus}">
          ${escapeHtml(statusLabel(currentStatus))}
        </span>
      </div>

      <p>
        <strong>Sichtbar:</strong> ${r.visible ? "ja" : "nein"}<br>
        <strong>Datum:</strong> ${formatDate(r.created_at)}<br>
        <strong>Ort:</strong> ${escapeHtml(r.address || "–")}<br>
        <strong>Belastung:</strong> ${escapeHtml(r.severity || "–")}/5
        <span class="severityBar">${severityBar(r.severity)}</span><br>
        <strong>Seit:</strong> ${escapeHtml(r.since || "–")}<br>
        <strong>Tageszeit:</strong> ${escapeHtml(r.time_of_day || "–")}
      </p>

      <p><strong>Bemerkung:</strong><br>${escapeHtml(r.note || "–")}</p>
      <p><strong>Kontakt intern:</strong><br>${escapeHtml(r.contact_private || "–")}</p>

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

  if (action === "approve") {
    patch = { status: "approved", visible: true };
  }

  if (action === "hide") {
    patch = { status: "hidden", visible: false };
  }

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
    "Datum",
    "Status",
    "Sichtbar",
    "Ort",
    "Belastung",
    "Seit",
    "Tageszeit",
    "Bemerkung",
    "Kontakt"
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
      r.contact_private || ""
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
