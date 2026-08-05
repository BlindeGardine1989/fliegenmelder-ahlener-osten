import { supabase, escapeHtml } from "./app.js";

const knowledgeList =
  document.querySelector("#cmsKnowledgeList") ||
  document.querySelector("#knowledgeList");

const categoryOrder = [
  "plattform",
  "fachwissen",
  "dokumentation"
];

const categoryConfig = {
  plattform: {
    icon: "🪰",
    title: "Der Fliegenmelder",
    description:
      "Alles rund um die Plattform, den Ablauf einer Meldung und den Schutz persönlicher Daten."
  },
  fachwissen: {
    icon: "🔬",
    title: "Fachwissen",
    description:
      "Hintergrundinformationen zur Fliegenbelastung, Entwicklung und möglichen Bekämpfungsmaßnahmen."
  },
  dokumentation: {
    icon: "📊",
    title: "Dokumentation & Transparenz",
    description:
      "Wie die veröffentlichten Daten einzuordnen sind und welche Aussagen daraus abgeleitet werden können."
  }
};

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
    .select(
      "id, title, summary, body, category, visible, sort_order, created_at"
    )
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

  const groupedEntries = new Map(
    categoryOrder.map(category => [category, []])
  );

  entries.forEach(entry => {
    const category = categoryConfig[entry.category]
      ? entry.category
      : "plattform";

    groupedEntries.get(category).push(entry);
  });

  knowledgeList.innerHTML = categoryOrder
    .filter(category => groupedEntries.get(category).length > 0)
    .map(category => renderCategory(
      category,
      groupedEntries.get(category)
    ))
    .join("");
}

function renderCategory(category, entries) {
  const config = categoryConfig[category];

  return `
    <section class="knowledgeCategory" aria-labelledby="knowledge-${category}">
      <header class="knowledgeCategory__header">
        <span class="knowledgeCategory__icon" aria-hidden="true">
          ${config.icon}
        </span>

        <div>
          <h2 id="knowledge-${category}">
            ${escapeHtml(config.title)}
          </h2>

          <p>${escapeHtml(config.description)}</p>
        </div>
      </header>

      <div class="knowledgeCategory__list">
        ${entries.map(renderEntry).join("")}
      </div>
    </section>
  `;
}

function renderEntry(entry) {
  const title = escapeHtml(entry.title || "");
  const summary = escapeHtml(entry.summary || "");
  const content = formatContent(entry.body || "");

  return `
    <article class="box knowledgeItem">
      <h3>${title}</h3>

      ${
        summary
          ? `<p class="knowledgeSummary">${summary}</p>`
          : ""
      }

      <div class="knowledgeContent">
        ${content}
      </div>
    </article>
  `;
}

function formatContent(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => {
      const safeParagraph = escapeHtml(paragraph)
        .replace(/\n/g, "<br>");

      return `<p>${safeParagraph}</p>`;
    })
    .join("");
}
