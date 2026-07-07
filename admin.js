import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const loginBox = $("#loginBox"), adminPanel = $("#adminPanel"), loginEmail = $("#loginEmail"), loginPassword = $("#loginPassword"), loginButton = $("#loginButton"), forgotPasswordButton = $("#forgotPasswordButton"), loginStatus = $("#loginStatus"), logoutButton = $("#logoutButton"), status = $("#adminStatus"), list = $("#adminList"), exportButton = $("#exportCsv"), searchInput = $("#adminSearch"), filterSelect = $("#adminFilter"), statTotal = $("#statTotal"), statApproved = $("#statApproved"), statPending = $("#statPending"), statAvg = $("#statAvg");
let allReports = [];

function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function formatDate(value) { return value ? new Date(value).toLocaleString("de-DE") : "–"; }
function statusLabel(value) { return value === "approved" ? "Freigegeben" : value === "hidden" ? "Ausgeblendet" : "In Prüfung"; }
function hasCoords(report) { return report.lat !== null && report.lat !== undefined && report.lng !== null && report.lng !== undefined && String(report.lat).trim() !== "" && String(report.lng).trim() !== ""; }
function severityBar(value) { const n = Number(value); const amount = Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0; return "●".repeat(amount) + "○".repeat(5 - amount); }
function mapsUrl(report) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((report.address || "") + " Ahlen")}`; }

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  loginBox.hidden = !!data.session;
  adminPanel.hidden = !data.session;
  if (data.session) await loadReports();
}

loginButton?.addEventListener("click", async () => {
  loginStatus.textContent = "Login wird geprüft ...";
  const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.value.trim(), password: loginPassword.value });
  if (error) { console.error(error); loginStatus.textContent = "Login fehlgeschlagen."; return; }
  loginPassword.value = ""; loginStatus.textContent = ""; await checkSession();
});

forgotPasswordButton?.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  if (!email) { loginStatus.textContent = "Bitte zuerst die E-Mail-Adresse eintragen."; return; }
  loginStatus.textContent = "E-Mail zum Zurücksetzen wird gesendet ...";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://fliegenmelder-ahlener-osten.pages.dev/reset-password.html" });
  if (error) { console.error(error); loginStatus.textContent = "E-Mail konnte nicht gesendet werden."; return; }
  loginStatus.textContent = "E-Mail wurde gesendet. Bitte Postfach prüfen.";
});

logoutButton?.addEventListener("click", async () => { await supabase.auth.signOut(); await checkSession(); });
searchInput?.addEventListener("input", renderCurrentView);
filterSelect?.addEventListener("change", renderCurrentView);

async function loadReports() {
  status.textContent = "Meldungen werden geladen ...";
  const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); status.textContent = "Meldungen konnten nicht geladen werden."; return; }
  allReports = data || [];
  updateStats(allReports);
  renderCurrentView();
}

function updateStats(reports) {
  const severities = reports.map(r => Number(r.severity)).filter(Number.isFinite);
  statTotal.textContent = reports.length;
  statApproved.textContent = reports.filter(r => r.visible === true || r.status === "approved").length;
  statPending.textContent = reports.filter(r => !r.visible && (r.status || "pending") === "pending").length;
  statAvg.textContent = severities.length ? (severities.reduce((a,b)=>a+b,0) / severities.length).toFixed(1) : "0";
}

function getFilteredReports() {
  const search = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterSelect?.value || "all";
  return allReports.filter(r => {
    const reportStatus = r.status || "pending";
    if (filter !== "all" && reportStatus !== filter) return false;
    if (!search) return true;
    return [r.address, r.note, r.contact_private, r.since, r.time_of_day, r.status].join(" ").toLowerCase().includes(search);
  });
}
function renderCurrentView() { renderReports(getFilteredReports()); }

function renderReports(reports) {
  list.innerHTML = "";
  if (!reports.length) { list.innerHTML = `<article class="adminCard"><p>Keine passenden Meldungen vorhanden.</p></article>`; status.textContent = "Keine passenden Meldungen vorhanden."; return; }
  status.textContent = `${reports.length} Meldung(en) angezeigt.`;
  reports.forEach(report => {
    const id = report.id, title = report.public_id || report.id || "Meldung", reportStatus = report.status || "pending";
    const card = document.createElement("article");
    card.className = `adminCard status-${reportStatus}`;
    card.dataset.id = id;
    card.innerHTML = `
      <div class="adminCardHead"><div><p class="eyebrow">${statusLabel(reportStatus)}</p><h2>Meldung ${escapeHtml(String(title).slice(0,8))}</h2></div><span class="statusBadge ${reportStatus}">${escapeHtml(statusLabel(reportStatus))}</span></div>
      <p><strong>Sichtbar:</strong> ${report.visible ? "ja" : "nein"}<br><strong>Datum:</strong> ${formatDate(report.created_at)}<br><strong>Straße/Hausnummer:</strong> ${escapeHtml(report.address || "–")}<br><strong>Belastung:</strong> ${escapeHtml(report.severity || "–")}/5 <span class="severityBar">${severityBar(report.severity)}</span><br><strong>Seit:</strong> ${escapeHtml(report.since || "–")}<br><strong>Tageszeit:</strong> ${escapeHtml(report.time_of_day || "–")}</p>
      <p><strong>Bemerkung:</strong><br>${escapeHtml(report.note || "–")}</p>
      <p><strong>Kontakt intern:</strong><br>${escapeHtml(report.contact_private || "–")}</p>
      <div class="coordBox"><p><strong>Kartenposition:</strong> ${hasCoords(report) ? "Koordinaten vorhanden." : "Noch keine Koordinaten gespeichert – ohne Koordinaten erscheint kein Pin auf der Karte."}</p><div class="coordGrid"><label>Breitengrad lat<input data-field="lat" type="number" step="any" inputmode="decimal" value="${escapeHtml(report.lat ?? "")}"></label><label>Längengrad lng<input data-field="lng" type="number" step="any" inputmode="decimal" value="${escapeHtml(report.lng ?? "")}"></label></div><div class="adminControls"><a class="button secondary" href="${mapsUrl(report)}" target="_blank" rel="noopener">Position in Google Maps öffnen</a><button class="button secondary" data-action="saveCoords" data-id="${id}">Koordinaten speichern</button></div></div>
      <div class="adminControls"><button class="button" data-action="approve" data-id="${id}">Freigeben</button><button class="button secondary" data-action="pending" data-id="${id}">Zurück auf Prüfung</button><button class="button danger" data-action="hide" data-id="${id}">Ausblenden</button><button class="button danger" data-action="delete" data-id="${id}">Löschen</button></div>`;
    list.appendChild(card);
  });
  list.querySelectorAll("button[data-action]").forEach(button => button.addEventListener("click", () => handleAction(button)));
}

async function handleAction(button) {
  const id = button.dataset.id, action = button.dataset.action;
  if (action === "saveCoords") {
    const card = button.closest(".adminCard");
    const lat = Number(String(card.querySelector('[data-field="lat"]').value || "").replace(",", "."));
    const lng = Number(String(card.querySelector('[data-field="lng"]').value || "").replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { alert("Bitte gültige Zahlen für lat und lng eintragen."); return; }
    const { error } = await supabase.from("reports").update({ lat, lng }).eq("id", id);
    if (error) { console.error(error); alert("Koordinaten konnten nicht gespeichert werden."); return; }
    status.textContent = "Koordinaten gespeichert."; await loadReports(); return;
  }
  if (action === "delete") {
    if (!confirm("Diese Meldung wirklich löschen?")) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) { console.error(error); alert("Löschen nicht möglich."); return; }
    await loadReports(); return;
  }
  let patch = { status: "pending", visible: false };
  if (action === "approve") patch = { status: "approved", visible: true };
  if (action === "hide") patch = { status: "hidden", visible: false };
  const { error } = await supabase.from("reports").update(patch).eq("id", id);
  if (error) { console.error(error); alert("Änderung nicht möglich."); return; }
  await loadReports();
}

exportButton?.addEventListener("click", () => {
  const rows = getFilteredReports();
  const header = ["Datum","Status","Sichtbar","Ort","Belastung","Seit","Tageszeit","Bemerkung","Kontakt","Lat","Lng"];
  const csv = [header.join(";"), ...rows.map(r => [formatDate(r.created_at), r.status || "", r.visible ? "ja" : "nein", r.address || "", r.severity || "", r.since || "", r.time_of_day || "", r.note || "", r.contact_private || "", r.lat || "", r.lng || ""].map(v => `"${String(v).replaceAll('"','""')}"`).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "fliegenmelder-meldungen.csv"; a.click(); URL.revokeObjectURL(url);
});

checkSession();
