
import { supabase, escapeHtml } from "./app.js";

function formatDate(value) {
  if (!value) return "Datum wird ergänzt";
  return new Date(value).toLocaleDateString("de-DE");
}

function emptyText(text) {
  return `<article class="card"><p>${escapeHtml(text)}</p></article>`;
}

async function loadNews() {
  const list = document.querySelector("#cmsNewsList");
  const home = document.querySelector("#cmsLatestNews");
  if (!list && !home) return;

  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("visible", true)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    if (list) list.innerHTML = emptyText("Neuigkeiten konnten nicht geladen werden.");
    return;
  }

  const rows = data || [];

  if (list) {
    if (!rows.length) {
      list.innerHTML = emptyText("Noch keine Neuigkeiten vorhanden.");
    } else {
      list.innerHTML = rows.map(item => `
        <article class="card">
          ${item.image_url ? `<img class="newsImage" src="${escapeHtml(item.image_url)}" alt="">` : ""}
          <p class="docMeta">📅 ${formatDate(item.date)}</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p>${escapeHtml(item.summary || item.body || "")}</p>
          ${item.body ? `<details><summary>Weiterlesen</summary><p>${escapeHtml(item.body)}</p></details>` : ""}
        </article>
      `).join("");
    }
  }

  if (home) {
    const latest = rows[0];
    home.innerHTML = latest ? `
      <article class="card">
        ${latest.image_url ? `<img class="newsImage" src="${escapeHtml(latest.image_url)}" alt="">` : ""}
        <p class="eyebrow">Neueste Entwicklung</p>
        <h2>${escapeHtml(latest.title)}</h2>
        <p>${escapeHtml(latest.summary || latest.body || "")}</p>
        <a href="neuigkeiten.html">Aktuelle Informationen ansehen →</a>
      </article>
    ` : `
      <article class="card">
        <p class="eyebrow">Neueste Entwicklung</p>
        <h2>Aktuelle Entwicklung</h2>
        <p>Neue Informationen und Entwicklungen werden hier veröffentlicht.</p>
        <a href="neuigkeiten.html">Aktuelle Informationen ansehen →</a>
      </article>
    `;
  }
}

async function loadTimeline() {
  const list = document.querySelector("#cmsTimelineList");
  if (!list) return;

  const { data, error } = await supabase
    .from("timeline")
    .select("*")
    .eq("visible", true)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    list.innerHTML = emptyText("Chronik konnte nicht geladen werden.");
    return;
  }

  const rows = data || [];
  list.innerHTML = rows.length ? rows.map(item => `
    <article class="timelineItem">
      <strong>${formatDate(item.date)}</strong>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.description || "")}</p>
    </article>
  `).join("") : emptyText("Noch keine Chronik-Einträge vorhanden.");
}

async function loadFaq() {
  const list = document.querySelector("#cmsFaqList");
  if (!list) return;

  const { data, error } = await supabase
    .from("faq")
    .select("*")
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    list.innerHTML = emptyText("FAQ konnten nicht geladen werden.");
    return;
  }

  const rows = data || [];
  list.innerHTML = rows.length ? rows.map((item, index) => `
    <details ${index === 0 ? "open" : ""}>
      <summary>${escapeHtml(item.question)}</summary>
      <p>${escapeHtml(item.answer || "")}</p>
    </details>
  `).join("") : emptyText("Noch keine FAQ vorhanden.");
}

async function loadEvents() {
  const list = document.querySelector("#cmsEventsList");
  if (!list) return;

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = emptyText("Termine konnten nicht geladen werden.");
    return;
  }

  const rows = data || [];
  list.innerHTML = rows.length ? rows.map(item => `
    <article class="card">
      <p class="docMeta">📅 ${formatDate(item.event_date)}</p>
      <h2>${escapeHtml(item.title)}</h2>
      ${item.location ? `<p><strong>Ort:</strong> ${escapeHtml(item.location)}</p>` : ""}
      <p>${escapeHtml(item.description || "")}</p>
    </article>
  `).join("") : `
    <article class="card">
      <p class="eyebrow">Demnächst</p>
      <h2>Zurzeit sind keine öffentlichen Termine angekündigt</h2>
      <p>Neue Termine werden hier veröffentlicht, sobald sie feststehen.</p>
    </article>
  `;
}

async function loadDocuments() {
  const list = document.querySelector("#cmsDocumentsList");
  if (!list) return;

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("visible", true)
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = emptyText("Dokumente konnten nicht geladen werden.");
    return;
  }

  const rows = data || [];
  list.innerHTML = rows.length ? rows.map(item => `
    <article class="card">
      <h2>${escapeHtml(item.title)}</h2>
      <p class="docMeta">📅 ${formatDate(item.document_date)}</p>
      <p>${escapeHtml(item.description || "")}</p>
      ${item.file_url ? `<a class="button secondary" href="${escapeHtml(item.file_url)}" target="_blank" rel="noopener">PDF öffnen</a>` : ""}
    </article>
  `).join("") : `
    <article class="card">
      <h2>Dokumente werden ergänzt</h2>
      <p>Wichtige Schreiben und Unterlagen werden hier veröffentlicht.</p>
    </article>
  `;
}

async function loadSettings() {
  const nodes = document.querySelectorAll("[data-setting]");
  if (!nodes.length) return;

  const { data, error } = await supabase
    .from("site_settings")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  const settings = {};
  (data || []).forEach(row => {
    settings[row.key] = row.value || "";
  });

  nodes.forEach(node => {
    const key = node.dataset.setting;
    if (settings[key] && String(settings[key]).trim()) {
      if (node.tagName === "IMG") {
        node.src = settings[key];
        node.hidden = false;
      } else {
        node.textContent = settings[key];
      }
    }
  });
}


async function loadKnowledge() {
  const list = document.querySelector("#cmsKnowledgeList");
  if (!list) return;

  const { data, error } = await supabase
    .from("knowledge")
    .select("*")
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    list.innerHTML = emptyText("Wissenswertes konnte nicht geladen werden.");
    return;
  }

  const rows = data || [];

  list.innerHTML = rows.length ? rows.map(item => `
    <article class="card knowledgeCard">
      <p class="eyebrow">Wissenswertes</p>
      <h2>${escapeHtml(item.title)}</h2>
      ${item.summary ? `<p><strong>${escapeHtml(item.summary)}</strong></p>` : ""}
      <p>${escapeHtml(item.body || "")}</p>
    </article>
  `).join("") : emptyText("Noch keine Beiträge vorhanden.");
}


loadSettings();
loadKnowledge();
loadNews();
loadTimeline();
loadFaq();
loadEvents();
loadDocuments();
