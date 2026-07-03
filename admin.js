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

  renderReports(data || []);
}

function renderReports(reports) {
  list.innerHTML = "";

  if (!reports.length) {
    list.innerHTML = `<article class="adminCard"><p>Keine Meldungen vorhanden.</p></article>`;
    status.textContent = "Keine Meldungen vorhanden.";
    return;
  }

  status.textContent = `${reports.length} Meldung(en) gefunden.`;

  reports.forEach(r => {
    const id = r.id;
    const title = r.public_id || r.id || "Meldung";

    const card = document.createElement("article");
    card.className = "adminCard";

    card.innerHTML = `
      <h2>Meldung ${escapeHtml(String(title).slice(0, 8))}</h2>
      <p>
        <strong>Status:</strong> ${escapeHtml(r.status || "pending")}<br>
        <strong>Sichtbar:</strong> ${r.visible ? "ja" : "nein"}<br>
        <strong>Datum:</strong> ${formatDate(r.created_at)}<br>
        <strong>Ort:</strong> ${escapeHtml(r.address || "–")}<br>
        <strong>Belastung:</strong> ${escapeHtml(r.severity || "–")}/5<br>
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

exportButton?.addEventListener("click", async () => {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert("CSV konnte nicht erstellt werden.");
    return;
  }

  const rows = data || [];
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
