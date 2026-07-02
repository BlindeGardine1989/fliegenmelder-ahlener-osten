import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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

const status = document.querySelector("#adminStatus");
const list = document.querySelector("#adminList");

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
    const card = document.createElement("article");
    card.className = "adminCard";

    card.innerHTML = `
      <h2>Meldung ${escapeHtml((r.public_id || r.id || "").slice(0, 8))}</h2>
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
        <button class="button" data-action="approve" data-id="${r.id}">Freigeben</button>
        <button class="button secondary" data-action="pending" data-id="${r.id}">Zurück auf Prüfung</button>
        <button class="button danger" data-action="hide" data-id="${r.id}">Ausblenden</button>
        <button class="button danger" data-action="delete" data-id="${r.id}">Löschen</button>
      </div>
    `;

    list.appendChild(card);
  });

  list.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === "delete") {
        if (!confirm("Diese Meldung wirklich löschen?")) return;

        const { error } = await supabase
          .from("reports")
          .delete()
          .eq("id", id);

        if (error) {
          console.error(error);
          alert("Löschen nicht möglich.");
          return;
        }

        await loadReports();
        return;
      }

      const patch =
        action === "approve"
          ? { status: "approved", visible: true }
          : action === "hide"
            ? { status: "hidden", visible: false }
            : { status: "pending", visible: false };

      const { error } = await supabase
        .from("reports")
        .update(patch)
        .eq("id", id);

      if (error) {
        console.error(error);
        alert("Änderung nicht möglich.");
        return;
      }

      await loadReports();
    });
  });
}

loadReports();
