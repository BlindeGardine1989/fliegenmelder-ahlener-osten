
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBox = document.querySelector("#loginBox");
const adminPanel = document.querySelector("#adminPanel");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const loginStatus = document.querySelector("#loginStatus");
const logoutButton = document.querySelector("#logoutButton");

const cmsTitle = document.querySelector("#cmsTitle");
const navButtons = document.querySelectorAll(".cmsNav button");

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

function hasCoords(report) {
  return report.lat !== null && report.lat !== undefined &&
    report.lng !== null && report.lng !== undefined &&
    String(report.lat).trim() !== "" && String(report.lng).trim() !== "";
}

function showView(name) {
  document.querySelectorAll(".cmsView").forEach(view => {
    view.hidden = view.id !== `view-${name}`;
  });

  navButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  const labels = {
    dashboard: "Dashboard",
    website: "Website",
    reports: "Meldungen",
    news: "Neuigkeiten",
    timeline: "Chronik",
    faq: "FAQ",
    documents: "Dokumente",
    events: "Termine"
  };

  cmsTitle.textContent = labels[name] || "CMS";

  if (name === "website") loadSettings();
  if (name === "reports") renderCurrentView();
  if (name === "news") loadCmsTable("news");
  if (name === "timeline") loadCmsTable("timeline");
  if (name === "faq") loadCmsTable("faq");
  if (name === "documents") loadCmsTable("documents");
  if (name === "events") loadCmsTable("events");
}

navButtons.forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

async function checkSession() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    loginBox.hidden = true;
    adminPanel.hidden = false;
    await loadReports();
    await loadCmsTable("news");
    await loadCmsTable("timeline");
    await loadSettings();
    await loadCmsTable("faq");
    await loadCmsTable("documents");
    await loadCmsTable("events");
    showView("dashboard");
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

forgotPasswordButton?.addEventListener("click", async () => {
  const email = loginEmail.value.trim();

  if (!email) {
    loginStatus.textContent = "Bitte zuerst die E-Mail-Adresse eintragen.";
    return;
  }

  loginStatus.textContent = "E-Mail zum Zurücksetzen wird gesendet ...";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://fliegenmelder-ahlener-osten.pages.dev/reset-password.html"
  });

  if (error) {
    console.error(error);
    loginStatus.textContent = "E-Mail konnte nicht gesendet werden.";
    return;
  }

  loginStatus.textContent = "E-Mail wurde gesendet. Bitte Postfach prüfen.";
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await checkSession();
});

searchInput?.addEventListener("input", renderCurrentView);
filterSelect?.addEventListener("change", renderCurrentView);

async function loadReports() {
  if (status) status.textContent = "Meldungen werden geladen ...";

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    if (status) status.textContent = "Meldungen konnten nicht geladen werden.";
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
  const severityValues = reports.map(r => Number(r.severity)).filter(Number.isFinite);
  const avg = severityValues.length
    ? (severityValues.reduce((a, b) => a + b, 0) / severityValues.length).toFixed(1)
    : "0";

  statTotal.textContent = total;
  statApproved.textContent = approved;
  statPending.textContent = pending;
  statAvg.textContent = avg;
}

function getFilteredReports() {
  const search = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterSelect?.value || "all";

  return allReports.filter(report => {
    const reportStatus = report.status || "pending";
    if (filter !== "all" && reportStatus !== filter) return false;
    if (!search) return true;

    return [
      report.address,
      report.note,
      report.contact_private,
      report.since,
      report.time_of_day,
      report.status
    ].join(" ").toLowerCase().includes(search);
  });
}

function renderCurrentView() {
  if (!list) return;
  renderReports(getFilteredReports());
}

function severityBar(value) {
  const number = Number(value);
  const count = Number.isFinite(number) ? Math.max(0, Math.min(5, number)) : 0;
  return "●".repeat(count) + "○".repeat(5 - count);
}

function mapsUrl(report) {
  const query = encodeURIComponent(`${report.address || ""} Ahlen`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

async function geocodeAddress(report) {
  const address = `${report.address || ""}, Ahlen, Nordrhein-Westfalen, Deutschland`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("Geocoding fehlgeschlagen.");
  const results = await response.json();
  if (!results || !results.length) throw new Error("Adresse nicht gefunden.");
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

function renderReports(reports) {
  list.innerHTML = "";

  if (!reports.length) {
    list.innerHTML = `<article class="adminCard"><p>Keine passenden Meldungen vorhanden.</p></article>`;
    if (status) status.textContent = "Keine passenden Meldungen vorhanden.";
    return;
  }

  if (status) status.textContent = `${reports.length} Meldung(en) angezeigt.`;

  reports.forEach(report => {
    const id = report.id;
    const title = report.public_id || report.id || "Meldung";
    const reportStatus = report.status || "pending";
    const coordsAvailable = hasCoords(report);

    const card = document.createElement("article");
    card.className = `adminCard status-${reportStatus}`;

    card.innerHTML = `
      <div class="adminCardHead">
        <div>
          <p class="eyebrow">${statusLabel(reportStatus)}</p>
          <h2>Meldung ${escapeHtml(String(title).slice(0, 8))}</h2>
        </div>
        <span class="statusBadge ${reportStatus}">${escapeHtml(statusLabel(reportStatus))}</span>
      </div>

      <p>
        <strong>Sichtbar:</strong> ${report.visible ? "ja" : "nein"}<br>
        <strong>Datum:</strong> ${formatDate(report.created_at)}<br>
        <strong>Straße/Hausnummer:</strong> ${escapeHtml(report.address || "–")}<br>
        <strong>Belastung:</strong> ${escapeHtml(report.severity || "–")}/5
        <span class="severityBar">${severityBar(report.severity)}</span><br>
        <strong>Seit:</strong> ${escapeHtml(report.since || "–")}<br>
        <strong>Tageszeit:</strong> ${escapeHtml(report.time_of_day || "–")}
      </p>

      <p><strong>Bemerkung:</strong><br>${escapeHtml(report.note || "–")}</p>
      <p><strong>Kontakt intern:</strong><br>${escapeHtml(report.contact_private || "–")}</p>

      <div class="coordBox">
        <p><strong>Kartenposition:</strong> ${coordsAvailable ? "Koordinaten vorhanden." : "Noch keine Koordinaten gespeichert – ohne Koordinaten erscheint kein Pin auf der Karte."}</p>

        <div class="coordGrid">
          <label>Breitengrad lat
            <input type="number" step="any" inputmode="decimal" value="${escapeHtml(report.lat ?? "")}" data-lat="${id}">
          </label>
          <label>Längengrad lng
            <input type="number" step="any" inputmode="decimal" value="${escapeHtml(report.lng ?? "")}" data-lng="${id}">
          </label>
        </div>

        <div class="adminControls">
          <button class="button" data-action="autoCoords" data-id="${id}">Koordinaten aus Adresse holen</button>
          <a class="button secondary" href="${mapsUrl(report)}" target="_blank" rel="noopener">In Google Maps prüfen</a>
          <button class="button secondary" data-action="saveCoords" data-id="${id}">Koordinaten speichern</button>
        </div>
      </div>

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
  const report = allReports.find(r => String(r.id) === String(id));

  if (action === "autoCoords") {
    if (!report?.address) {
      alert("Keine Adresse vorhanden.");
      return;
    }

    try {
      if (status) status.textContent = "Koordinaten werden ermittelt ...";
      const coords = await geocodeAddress(report);
      const { error } = await supabase.from("reports").update({ lat: coords.lat, lng: coords.lng }).eq("id", id);
      if (error) throw error;
      if (status) status.textContent = `Koordinaten gespeichert: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
      await loadReports();
    } catch (error) {
      console.error(error);
      alert("Koordinaten konnten nicht automatisch ermittelt werden. Bitte Adresse prüfen oder manuell eintragen.");
    }

    return;
  }

  if (action === "saveCoords") {
    const latInput = list.querySelector(`input[data-lat="${CSS.escape(id)}"]`);
    const lngInput = list.querySelector(`input[data-lng="${CSS.escape(id)}"]`);
    const lat = Number(String(latInput?.value || "").replace(",", "."));
    const lng = Number(String(lngInput?.value || "").replace(",", "."));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("Bitte gültige Zahlen für lat und lng eintragen.");
      return;
    }

    const { error } = await supabase.from("reports").update({ lat, lng }).eq("id", id);

    if (error) {
      console.error(error);
      alert("Koordinaten konnten nicht gespeichert werden.");
      return;
    }

    if (status) status.textContent = "Koordinaten gespeichert.";
    await loadReports();
    return;
  }

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
  if (action === "approve") patch = { status: "approved", visible: true };
  if (action === "hide") patch = { status: "hidden", visible: false };

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
  const header = ["Datum","Status","Sichtbar","Ort","Belastung","Seit","Tageszeit","Bemerkung","Kontakt","Lat","Lng"];

  const csv = [
    header.join(";"),
    ...rows.map(r => [
      formatDate(r.created_at), r.status || "", r.visible ? "ja" : "nein",
      r.address || "", r.severity || "", r.since || "", r.time_of_day || "",
      r.note || "", r.contact_private || "", r.lat || "", r.lng || ""
    ].map(value => `"${String(value).replaceAll('"', '""')}"`).join(";"))
  ].join("\\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fliegenmelder-meldungen.csv";
  a.click();
  URL.revokeObjectURL(url);
});

function resetForm(form) {
  form.reset();
  form.querySelector('[name="id"]').value = "";
}

document.querySelectorAll("[data-reset-form]").forEach(button => {
  button.addEventListener("click", () => resetForm(document.querySelector(`#${button.dataset.resetForm}`)));
});

async function loadCmsTable(type) {
  const config = cmsConfig[type];
  if (!config) return;

  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .order(config.order, { ascending: false });

  if (error) {
    console.error(error);
    config.list.innerHTML = `<article class="adminCard"><p>Konnte nicht geladen werden.</p></article>`;
    return;
  }

  renderCmsList(type, data || []);
}

const cmsConfig = {
  news: {
    table: "news",
    form: document.querySelector("#newsForm"),
    list: document.querySelector("#newsList"),
    order: "date",
    titleField: "title"
  },
  timeline: {
    table: "timeline",
    form: document.querySelector("#timelineForm"),
    list: document.querySelector("#timelineList"),
    order: "date",
    titleField: "title"
  },
  faq: {
    table: "faq",
    form: document.querySelector("#faqForm"),
    list: document.querySelector("#faqList"),
    order: "sort_order",
    titleField: "question"
  },
  documents: {
    table: "documents",
    form: document.querySelector("#documentsForm"),
    list: document.querySelector("#documentsList"),
    order: "document_date",
    titleField: "title"
  },
  events: {
    table: "events",
    form: document.querySelector("#eventsForm"),
    list: document.querySelector("#eventsList"),
    order: "event_date",
    titleField: "title"
  }
};

function renderCmsList(type, rows) {
  const config = cmsConfig[type];
  config.list.innerHTML = "";

  if (!rows.length) {
    config.list.innerHTML = `<article class="adminCard"><p>Noch keine Einträge vorhanden.</p></article>`;
    return;
  }

  rows.forEach(row => {
    const card = document.createElement("article");
    card.className = "adminCard";

    const meta = row.date || row.created_at || "";

    card.innerHTML = `
      <div class="adminCardHead">
        <div>
          <p class="eyebrow">${row.visible ? "Sichtbar" : "Ausgeblendet"}</p>
          <h2>${escapeHtml(row[config.titleField] || "Eintrag")}</h2>
          <p>${escapeHtml(meta ? String(meta).slice(0, 10) : "")}</p>
        </div>
      </div>
      ${row.image_url ? `<img class="cmsThumb" src="${escapeHtml(row.image_url)}" alt="">` : ""}
      <p>${escapeHtml(row.summary || row.description || row.answer || row.location || "")}</p>
      ${row.file_url ? `<p><a href="${escapeHtml(row.file_url)}" target="_blank" rel="noopener">Datei öffnen</a></p>` : ""}
      <div class="adminControls">
        <button class="button secondary" data-cms-edit="${type}" data-id="${row.id}">Bearbeiten</button>
        <button class="button danger" data-cms-delete="${type}" data-id="${row.id}">Löschen</button>
      </div>
    `;

    config.list.appendChild(card);
  });

  config.list.querySelectorAll("[data-cms-edit]").forEach(button => {
    button.addEventListener("click", () => editCmsItem(button.dataset.cmsEdit, button.dataset.id, rows));
  });

  config.list.querySelectorAll("[data-cms-delete]").forEach(button => {
    button.addEventListener("click", () => deleteCmsItem(button.dataset.cmsDelete, button.dataset.id));
  });
}

function editCmsItem(type, id, rows) {
  const row = rows.find(item => String(item.id) === String(id));
  const form = cmsConfig[type].form;
  if (!row || !form) return;

  Object.keys(row).forEach(key => {
    if (form.elements[key]) {
      if (form.elements[key].type === "checkbox") {
        form.elements[key].checked = Boolean(row[key]);
      } else {
        form.elements[key].value = row[key] ?? "";
      }
    }
  });

  showView(type);
}

async function deleteCmsItem(type, id) {
  if (!confirm("Eintrag wirklich löschen?")) return;

  const config = cmsConfig[type];
  const { error } = await supabase.from(config.table).delete().eq("id", id);

  if (error) {
    console.error(error);
    alert("Löschen nicht möglich.");
    return;
  }

  await loadCmsTable(type);
}

Object.entries(cmsConfig).forEach(([type, config]) => {
  config.form?.addEventListener("submit", async event => {
    event.preventDefault();

    const form = config.form;
    const data = Object.fromEntries(new FormData(form).entries());
    data.visible = form.elements.visible.checked;

    const id = data.id;
    delete data.id;

    let result;

    if (id) {
      result = await supabase.from(config.table).update(data).eq("id", id);
    } else {
      result = await supabase.from(config.table).insert(data);
    }

    if (result.error) {
      console.error(result.error);
      alert("Speichern nicht möglich.");
      return;
    }

    resetForm(form);
    await loadCmsTable(type);
  });
});

const settingsForm = document.querySelector("#settingsForm");
const settingsStatus = document.querySelector("#settingsStatus");

async function loadSettings() {
  if (!settingsForm) return;

  const { data, error } = await supabase
    .from("site_settings")
    .select("*");

  if (error) {
    console.error(error);
    if (settingsStatus) settingsStatus.textContent = "Website-Texte konnten nicht geladen werden.";
    return;
  }

  const settings = {};
  (data || []).forEach(row => {
    settings[row.key] = row.value || "";
  });

  Array.from(settingsForm.elements).forEach(element => {
    if (element.name && settings[element.name] !== undefined) {
      element.value = settings[element.name];
    }
  });
}

settingsForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const entries = Array.from(new FormData(settingsForm).entries())
    .map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

  const { error } = await supabase
    .from("site_settings")
    .upsert(entries, { onConflict: "key" });

  if (error) {
    console.error(error);
    settingsStatus.textContent = "Speichern nicht möglich.";
    return;
  }

  settingsStatus.textContent = "Website-Texte gespeichert.";
});



function safeFileName(fileName) {
  return String(fileName || "datei")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function uploadPublicFile(bucket, file, folder = "") {
  if (!file) {
    alert("Bitte zuerst eine Datei auswählen.");
    return null;
  }

  const fileName = `${Date.now()}-${safeFileName(file.name)}`;
  const path = folder ? `${folder}/${fileName}` : fileName;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) {
    console.error(error);
    alert("Upload nicht möglich. Bitte Storage-Bucket und Policies prüfen.");
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

document.querySelector("#uploadGroupPhoto")?.addEventListener("click", async () => {
  const file = document.querySelector("#groupPhotoUpload")?.files?.[0];
  const url = await uploadPublicFile("website-media", file, "gruppenfoto");
  if (!url) return;

  const input = document.querySelector('#settingsForm [name="group_photo_url"]');
  if (input) input.value = url;

  if (settingsStatus) settingsStatus.textContent = "Gruppenfoto hochgeladen. Bitte Website-Texte speichern.";
});

document.querySelector("#uploadNewsImage")?.addEventListener("click", async () => {
  const file = document.querySelector("#newsImageUpload")?.files?.[0];
  const url = await uploadPublicFile("website-media", file, "news");
  if (!url) return;

  const input = document.querySelector('#newsForm [name="image_url"]');
  if (input) input.value = url;

  alert("Bild hochgeladen. Bitte Neuigkeit speichern.");
});

document.querySelector("#uploadDocumentFile")?.addEventListener("click", async () => {
  const file = document.querySelector("#documentFileUpload")?.files?.[0];
  const url = await uploadPublicFile("documents", file, "pdf");
  if (!url) return;

  const input = document.querySelector('#documentsForm [name="file_url"]');
  if (input) input.value = url;

  alert("PDF hochgeladen. Bitte Dokument speichern.");
});


checkSession();
