import { supabase, escapeHtml, formatDate } from "../js/app.js";
import { IS_CONFIGURED, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../js/config.js";

const status = document.querySelector("#adminStatus");
const list = document.querySelector("#adminList");
const exportBtn = document.querySelector("#exportCsv");

if (!IS_CONFIGURED || SUPABASE_PUBLISHABLE_KEY.includes("HIER_DEINEN")) {
  status.textContent = "Supabase ist noch nicht vollständig verbunden.";
} else {
  loadReports();
}

async function loadReports() {
  status.textContent = "Meldungen werden geladen ...";

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    status.textContent = "Meldungen konnten nicht geladen werden. Freigabe-Regeln werden im nächsten Schritt gesetzt.";
    return;
  }

  status.textContent = `${data.length} Meldung(en) gefunden.`;
  renderReports(data);
}

function renderReports(reports) {
  list.innerHTML = "";

  if (!reports.length) {
    list.innerHTML = `<article class="adminCard"><p>Noch keine Meldungen vorhanden.</p></article>`;
    return;
  }

  for (const r of reports) {
    const photoUrl = r.photo_path
      ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${r.photo_path}`
      : "";

    const statusClass =
      r.status === "approved" ? "" :
      r.status === "hidden" ? "red" :
      "warn";

    const card = document.createElement("article");
    card.className = "adminCard";
    card.innerHTML = `
      <h2>Meldung ${escapeHtml((r.public_id || r.id || "").slice(0, 8))}</h2>
      <p>
        <span class="badge ${statusClass}">${escapeHtml(r.status || "pending")}</span>
        · öffentlich sichtbar: <strong>${r.visible ? "ja" : "nein"}</strong>
      </p>
      <p>
        <strong>Datum:</strong> ${formatDate(r.client_timestamp || r.created_at)}<br>
        <strong>Ort:</strong> ${escapeHtml(r.address || "–")}<br>
        <strong>Belastung:</strong> ${escapeHtml(r.severity || "–")}/5<br>
        <strong>Seit:</strong> ${escapeHtml(r.since || "–")}<br>
        <strong>Tageszeit:</strong> ${escapeHtml(r.time_of_day || "–")}
      </p>
      <p><strong>Bemerkung:</strong><br>${escapeHtml(r.note || "–")}</p>
      <p><strong>Kontakt intern:</strong><br>${escapeHtml(r.contact_private || "–")}</p>
      ${photoUrl ? `<p><a href="${photoUrl}" target="_blank" rel="noopener">Foto öffnen</a></p><img src="${photoUrl}" alt="Foto zur Meldung">` : `<p><em>Kein Foto vorhanden.</em></p>`}
      <div class="adminControls">
        <button class="button" data-action="approve" data-id="${r.id}">Freigeben</button>
        <button class="button secondary" data-action="pending" data-id="${r.id}">Zurück auf Prüfung</button>
        <button class="button danger" data-action="hide" data-id="${r.id}">Ausblenden</button>
      </div>
    `;
    list.appendChild(card);
  }

  list.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      const id = button.dataset.id;

      const patch =
        action === "approve" ? { status: "approved", visible: true } :
        action === "hide" ? { status: "hidden", visible: false } :
        { status: "pending", visible: false };

      const { error } = await supabase.from("reports").update(patch).eq("id", id);

      if (error) {
        console.error(error);
        alert("Änderung nicht möglich. Die Admin-Rechte müssen noch in Supabase freigeschaltet werden.");
        return;
      }

      await loadReports();
    });
  });
}

exportBtn?.addEventListener("click", async () => {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert("CSV-Export nicht möglich.");
    console.error(error);
    return;
  }

  const rows = [
    ["Meldungsnummer","Status","Sichtbar","Datum","Adresse","Belastung","Seit wann","Tageszeit","Bemerkung","Kontakt intern","Latitude","Longitude","Foto"]
  ];

  for (const r of data) {
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

  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"','""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fliegenmelder-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
