import { supabase, escapeHtml, formatDate } from "../js/app.js";
import { IS_CONFIGURED, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../js/config.js";

const loginBox = document.querySelector("#loginBox");
const adminBox = document.querySelector("#adminBox");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginStatus = document.querySelector("#loginStatus");
const logoutBtn = document.querySelector("#logoutBtn");
const status = document.querySelector("#adminStatus");
const list = document.querySelector("#adminList");
const exportBtn = document.querySelector("#exportCsv");
const searchInput = document.querySelector("#adminSearch");
const filterSelect = document.querySelector("#adminFilter");

const statTotal = document.querySelector("#adminTotal");
const statPending = document.querySelector("#adminPending");
const statApproved = document.querySelector("#adminApproved");
const statHidden = document.querySelector("#adminHidden");

let allReports = [];

if (!IS_CONFIGURED || SUPABASE_PUBLISHABLE_KEY.includes("HIER_DEINEN")) {
  loginStatus.textContent = "Supabase ist noch nicht vollständig verbunden.";
} else {
  init();
}

async function init() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    showAdmin();
    await loadReports();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginBox.hidden = false;
  adminBox.hidden = true;
}

function showAdmin() {
  loginBox.hidden = true;
  adminBox.hidden = false;
}

loginForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const email = loginEmail.value.trim();
  loginStatus.textContent = "Login-Link wird gesendet ...";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/admin/` }
  });

  if (error) {
    console.error(error);
    loginStatus.textContent = "Login-Link konnte nicht gesendet werden.";
    return;
  }
  loginStatus.textContent = "Login-Link wurde gesendet. Bitte E-Mail-Postfach prüfen.";
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  allReports = [];
  list.innerHTML = "";
  showLogin();
});

searchInput?.addEventListener("input", renderFilteredReports);
filterSelect?.addEventListener("change", renderFilteredReports);

async function loadReports() {
  status.textContent = "Meldungen werden geladen ...";
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    status.textContent = "Kein Zugriff. Bitte Admin-Rechte und Supabase-Regeln prüfen.";
    return;
  }

  allReports = data || [];
  updateStats();
  renderFilteredReports();
}

function updateStats() {
  statTotal.textContent = allReports.length;
  statPending.textContent = allReports.filter(r => (r.status || "pending") === "pending").length;
  statApproved.textContent = allReports.filter(r => r.status === "approved").length;
  statHidden.textContent = allReports.filter(r => r.status === "hidden").length;
}

function renderFilteredReports() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterSelect?.value || "all";
  let reports = [...allReports];

  if (filter !== "all") reports = reports.filter(r => (r.status || "pending") === filter);

  if (query) {
    reports = reports.filter(r => {
      const haystack = [r.address, r.note, r.contact_private, r.since, r.time_of_day, r.public_id]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  status.textContent = `${reports.length} Meldung(en) angezeigt.`;
  renderReports(reports);
}

function renderReports(reports) {
  list.innerHTML = "";

  if (!reports.length) {
    list.innerHTML = `<article class="adminCard"><p>Noch keine passenden Meldungen vorhanden.</p></article>`;
    return;
  }

  for (const r of reports) {
    const photoUrl = r.photo_path
      ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${r.photo_path}`
      : "";

    const statusValue = r.status || "pending";
    const statusClass = statusValue === "approved" ? "" : statusValue === "hidden" ? "red" : "warn";
    const card = document.createElement("article");
    card.className = "adminCard";

    card.innerHTML = `
      <div class="adminCardHeader">
        <div>
          <h2>Meldung ${escapeHtml((r.public_id || r.id || "").slice(0, 8))}</h2>
          <p><span class="badge ${statusClass}">${escapeHtml(statusValue)}</span> · öffentlich sichtbar: <strong>${r.visible ? "ja" : "nein"}</strong></p>
        </div>
      </div>

      <div class="adminReportGrid">
        <p>
          <strong>Datum:</strong> ${formatDate(r.client_timestamp || r.created_at)}<br>
          <strong>Ort:</strong> ${escapeHtml(r.address || "–")}<br>
          <strong>Belastung:</strong> ${escapeHtml(r.severity || "–")}/5<br>
          <strong>Seit:</strong> ${escapeHtml(r.since || "–")}<br>
          <strong>Tageszeit:</strong> ${escapeHtml(r.time_of_day || "–")}
        </p>
        <p><strong>Kontakt intern:</strong><br>${escapeHtml(r.contact_private || "–")}</p>
      </div>

      <p><strong>Bemerkung:</strong><br>${escapeHtml(r.note || "–")}</p>
      ${photoUrl ? `<p><a href="${photoUrl}" target="_blank" rel="noopener">Foto öffnen</a></p><img src="${photoUrl}" alt="Foto zur Meldung">` : `<p><em>Kein Foto vorhanden.</em></p>`}

      <div class="adminControls">
        <button class="button" data-action="approve" data-id="${r.id}">Freigeben</button>
        <button class="button secondary" data-action="pending" data-id="${r.id}">Zurück auf Prüfung</button>
        <button class="button danger" data-action="hide" data-id="${r.id}">Ausblenden</button>
        <button class="button danger" data-action="delete" data-id="${r.id}">Löschen</button>
      </div>
    `;

    list.appendChild(card);
  }

  list.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === "delete") {
        if (!confirm("Diese Meldung wirklich endgültig löschen?")) return;
        const { error } = await supabase.from("reports").delete().eq("id", id);
        if (error) {
          console.error(error);
          alert("Löschen nicht möglich. Bitte Supabase-Delete-Regel prüfen.");
          return;
        }
        await loadReports();
        return;
      }

      const patch = action === "approve"
        ? { status: "approved", visible: true }
        : action === "hide"
          ? { status: "hidden", visible: false }
          : { status: "pending", visible: false };

      const { error } = await supabase.from("reports").update(patch).eq("id", id);
      if (error) {
        console.error(error);
        alert("Änderung nicht möglich. Bitte Admin-Rechte prüfen.");
        return;
      }
      await loadReports();
    });
  });
}

exportBtn?.addEventListener("click", () => {
  if (!allReports.length) {
    alert("Keine Meldungen zum Exportieren vorhanden.");
    return;
  }

  const rows = [["Meldungsnummer","Status","Sichtbar","Datum","Adresse","Belastung","Seit wann","Tageszeit","Bemerkung","Kontakt intern","Latitude","Longitude","Foto"]];

  for (const r of allReports) {
    rows.push([
      r.public_id || r.id || "",
      r.status || "",
      r.visible ? "ja" : "nein",
      r.client_timestamp || r.created_at || "",
      r.address || "",
      r.severity || "",
      r.since || "",
      r.time_of_day || "",
      r.note || "",
      r.contact_private || "",
      r.lat || "",
      r.lng || "",
      r.photo_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${r.photo_path}` : ""
    ]);
  }

  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"','""')}"`).join(";")).join("\\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `fliegenmelder-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
