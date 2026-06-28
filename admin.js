import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentReports = [];

async function loadReports() {
  const status = document.querySelector("#adminStatus");
  status.textContent = "Meldungen werden geladen ...";

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(error);
    status.textContent = "Admin-Zugriff noch nicht eingerichtet. Bitte Supabase Auth/RLS einrichten oder direkt in Supabase prüfen.";
    currentReports = [];
    render([]);
    return;
  }

  currentReports = data || [];
  status.textContent = `${currentReports.length} Meldungen gefunden.`;
  render(currentReports);
}

function render(reports) {
  const root = document.querySelector("#adminList");
  root.innerHTML = "";

  for (const r of reports) {
    const photoUrl = r.photo_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${r.photo_path}` : "";
    const card = document.createElement("article");
    card.className = "adminCard";
    card.innerHTML = `
      <h2>Meldung ${escapeHtml((r.public_id || r.id).slice(0,8))}</h2>
      <p><strong>Status:</strong> ${escapeHtml(r.status)} · <strong>Sichtbar:</strong> ${r.visible ? "ja" : "nein"}</p>
      <p><strong>Datum:</strong> ${escapeHtml(r.client_timestamp || r.created_at || "–")}</p>
      <p><strong>Ort:</strong> ${escapeHtml(r.address || "–")}<br>${r.lat}, ${r.lng}</p>
      <p><strong>Belastung:</strong> ${escapeHtml(r.severity)}/5 · <strong>Seit:</strong> ${escapeHtml(r.since || "–")} · <strong>Tageszeit:</strong> ${escapeHtml(r.time_of_day || "–")}</p>
      <p><strong>Bemerkung:</strong> ${escapeHtml(r.note || "–")}</p>
      <p><strong>Kontakt intern:</strong> ${escapeHtml(r.contact_private || "–")}</p>
      ${photoUrl ? `<a href="${photoUrl}" target="_blank"><img src="${photoUrl}" alt="Foto"></a>` : "<p>Kein Foto</p>"}
      <div class="adminControls">
        <button data-action="approve" data-id="${r.id}">Freigeben</button>
        <button class="danger" data-action="hide" data-id="${r.id}">Ausblenden</button>
      </div>
    `;
    root.appendChild(card);
  }

  root.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const patch = btn.dataset.action === "approve"
        ? { status: "approved", visible: true }
        : { status: "hidden", visible: false };

      const { error } = await supabase.from("reports").update(patch).eq("id", btn.dataset.id);
      if (error) {
        alert("Änderung fehlgeschlagen. Bitte Admin-Policies/Auth einrichten.");
        console.error(error);
        return;
      }
      await loadReports();
    });
  });
}

document.querySelector("#exportCsv")?.addEventListener("click", () => {
  const rows = [["Meldungsnummer","Status","Sichtbar","Datum","Adresse","Belastung","Seit wann","Tageszeit","Bemerkung","Kontakt intern","Latitude","Longitude","Foto"]];
  for (const r of currentReports) {
    rows.push([
      r.public_id || r.id, r.status || "", r.visible ? "ja" : "nein",
      r.client_timestamp || r.created_at || "", r.address || "", r.severity || "",
      r.since || "", r.time_of_day || "", r.note || "", r.contact_private || "",
      r.lat || "", r.lng || "", r.photo_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${r.photo_path}` : ""
    ]);
  }
  const csv = rows.map(row => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fliegenmelder-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function csvCell(value) { return `"${String(value ?? "").replaceAll('"','""')}"`; }
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
loadReports();
