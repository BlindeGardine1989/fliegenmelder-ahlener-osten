import { supabase, escapeHtml } from "./app.js";

const knowledgeList =
  document.querySelector("#cmsKnowledgeList") ||
  document.querySelector("#knowledgeList");

loadKnowledge();

async function loadKnowledge() {
  if (!knowledgeList) {
    console.error(
      "Der Bereich #cmsKnowledgeList oder #knowledgeList wurde nicht gefunden."
    );
    return;
  }

  knowledgeList.innerHTML = `
    <div class="box">
      Inhalte werden geladen …
    </div>
  `;

  const { data, error } = await supabase
    .from("knowledge")
    .select("id, title, summary, body, visible, sort_order, created_at")
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "Wissenswertes konnte nicht geladen werden:",
      error
    );

    knowledgeList.innerHTML = `
      <div class="box emptyState">
        Die Inhalte konnten leider nicht geladen werden.
      </div>
    `;

    return;
  }

  const entries = data || [];

  if (entries.length === 0) {
    knowledgeList.innerHTML = `
      <div class="box emptyState">
        Zurzeit sind noch keine Beiträge vorhanden.
      </div>
    `;

    return;
  }

  knowledgeList.innerHTML = entries
    .map((entry) => {
      const title = escapeHtml(entry.title || "");
      const summary = escapeHtml(entry.summary || "");
     const content = formatContent(entry.body || "");

      return `
        <article class="box knowledgeItem">
          <h2>${title}</h2>

          ${
            summary
              ? `<p class="lead">${summary}</p>`
              : ""
          }

          <div class="knowledgeContent">
            ${content}
          </div>
        </article>
      `;
    })
    .join("");
}

function formatContent(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const safeParagraph = escapeHtml(paragraph)
        .replace(/\n/g, "<br>");

      return `<p>${safeParagraph}</p>`;
    })
    .join("");
}
