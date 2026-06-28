import { SUPABASE_URL, SUPABASE_ANON_KEY, ORT_LAT, ORT_LNG, START_ZOOM } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let allReports = [];
let reportsLayer;

const map = L.map("map").setView([ORT_LAT, ORT_LNG], START_ZOOM);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

reportsLayer = L.layerGroup().addTo(map);
let selectedMarker = null;

map.on("click", (event) => setLocation(event.latlng.lat, event.latlng.lng, "Ausgewählter Standort"));

document.querySelector("#useGps")?.addEventListener("click", () => {
  const status = document.querySelector("#status");
  if (!navigator.geolocation) {
    status.textContent = "GPS wird von diesem Gerät nicht unterstützt.";
    return;
  }
  status.textContent = "Standort wird ermittelt ...";
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      setLocation(latitude, longitude, "Aktueller Standort");
      map.setView([latitude, longitude], 17);
      status.textContent = "Standort übernommen.";
    },
    () => status.textContent = "Standort konnte nicht ermittelt werden."
  );
});

document.querySelector("#severityFilter")?.addEventListener("change", renderReports);

function setLocation(lat, lng, label) {
  document.querySelector("#lat").value = lat;
  document.querySelector("#lng").value = lng;
  if (selectedMarker) selectedMarker.remove();
  selectedMarker = L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
}

document.querySelector("#reportForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#status");
  const lat = Number(document.querySelector("#lat").value);
  const lng = Number(document.querySelector("#lng").value);

  if (!lat || !lng) {
    status.textContent = "Bitte Standort per Karte oder GPS auswählen.";
    return;
  }

  status.textContent = "Meldung wird gespeichert ...";
  const publicId = crypto.randomUUID();
  let photoPath = null;

  try {
    const file = document.querySelector("#photo").files[0];
    if (file) {
      status.textContent = "Foto wird verkleinert und hochgeladen ...";
      const compressed = await compressImage(file, 1400, 0.70);
      photoPath = `${publicId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("report-photos")
        .upload(photoPath, compressed, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
    }

    const payload = {
      public_id: publicId,
      address: document.querySelector("#address").value.trim(),
      severity: Number(document.querySelector("#severity").value),
      since: document.querySelector("#since").value,
      time_of_day: document.querySelector("#time_of_day").value,
      note: document.querySelector("#note").value.trim(),
      contact_private: document.querySelector("#contact").value.trim(),
      lat,
      lng,
      photo_path: photoPath,
      status: "pending",
      visible: false,
      client_timestamp: new Date().toISOString()
    };

    const { error } = await supabase.from("reports").insert(payload);
    if (error) throw error;

    status.textContent = `Danke! Die Meldung ${publicId.slice(0, 8)} wurde eingereicht und wird geprüft.`;
    event.target.reset();
    if (selectedMarker) {
      selectedMarker.remove();
      selectedMarker = null;
    }
  } catch (err) {
    console.error(err);
    status.textContent = "Fehler beim Speichern. Bitte Supabase-Einstellungen prüfen.";
  }
});

async function loadApprovedReports() {
  const { data, error } = await supabase
    .from("reports_public")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase noch nicht verbunden oder View fehlt. Demo-Daten werden angezeigt.", error);
    allReports = demoReports();
  } else {
    allReports = data || [];
  }
  renderReports();
  renderStats();
  renderLatest();
}

function renderReports() {
  const filter = document.querySelector("#severityFilter")?.value || "all";
  reportsLayer.clearLayers();

  const reports = allReports.filter(r => {
    if (filter === "all") return true;
    if (filter === "4plus") return Number(r.severity) >= 4;
    return Number(r.severity) === Number(filter);
  });

  for (const r of reports) {
    const photo = r.photo_url ? `<img class="popupPhoto" src="${r.photo_url}" alt="Foto zur Meldung">` : "";
    const popup = `
      <strong>${escapeHtml(r.address)}</strong><br>
      Meldung: ${escapeHtml((r.public_id || "").slice(0, 8))}<br>
      Belastung: ${r.severity}/5<br>
      Seit: ${escapeHtml(r.since || "Unklar")}<br>
      Tageszeit: ${escapeHtml(r.time_of_day || "Unklar")}<br>
      ${photo}
      ${r.note ? "<br>Bemerkung: " + escapeHtml(r.note) : ""}
    `;
    L.marker([r.lat, r.lng], { icon: iconForSeverity(r.severity) }).addTo(reportsLayer).bindPopup(popup);
  }
}

function renderStats() {
  const total = allReports.length;
  const hotspots = allReports.filter(r => Number(r.severity) >= 4).length;
  const avg = total ? allReports.reduce((s, r) => s + Number(r.severity || 0), 0) / total : null;
  const now = new Date();
  const month = allReports.filter(r => {
    const d = new Date(r.created_at || r.client_timestamp || Date.now());
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  setText("#statTotal", total);
  setText("#statMonth", month);
  setText("#statHotspots", hotspots);
  setText("#statAvg", avg ? avg.toFixed(1) : "–");
}

function renderLatest() {
  const root = document.querySelector("#latestReports");
  if (!root) return;
  root.innerHTML = "";
  allReports.slice(0, 5).forEach(r => {
    const item = document.createElement("div");
    item.className = "latestItem";
    item.innerHTML = `
      <span class="dot s${Number(r.severity)}"></span>
      <div><strong>${escapeHtml(r.address)}</strong><br><small>${formatDate(r.created_at || r.client_timestamp)}</small></div>
      <strong>${r.severity}/5</strong>
    `;
    root.appendChild(item);
  });
}

function iconForSeverity(severity) {
  return L.divIcon({
    className: "",
    html: `<span class="marker-dot s${Number(severity)}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

async function compressImage(file, maxWidth = 1400, quality = 0.70) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
}

function demoReports() {
  return [
    {public_id:"demo-1", address:"Oststraße", severity:4, since:"Seit einigen Tagen", time_of_day:"Ganztägig", lat:51.7669, lng:7.9321, created_at:new Date().toISOString(), note:"Viele Fliegen im Außenbereich."},
    {public_id:"demo-2", address:"Münsterstraße", severity:5, since:"Seit einer Woche", time_of_day:"Nachmittags", lat:51.7722, lng:7.9125, created_at:new Date().toISOString(), note:"Auch im Haus stark bemerkbar."},
    {public_id:"demo-3", address:"Im Bereich Ahlener Osten", severity:3, since:"Unklar", time_of_day:"Abends", lat:51.7586, lng:7.9472, created_at:new Date().toISOString(), note:"Mittelstarke Belastung."},
    {public_id:"demo-4", address:"Südlich der B63", severity:2, since:"Heute", time_of_day:"Morgens", lat:51.7548, lng:7.9244, created_at:new Date().toISOString(), note:"Einige Fliegen."}
  ];
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle:"short", timeStyle:"short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

loadApprovedReports();
