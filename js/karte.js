import { loadPublicReports, escapeHtml, markerIcon, mapDefaults } from "./app.js";

const reports=await loadPublicReports();
const map=L.map("map").setView([mapDefaults.ORT_LAT,mapDefaults.ORT_LNG],mapDefaults.START_ZOOM);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap-Mitwirkende"}).addTo(map);
const layer=L.layerGroup().addTo(map);
const filter=document.querySelector("#severityFilter");
const empty = document.querySelector("#emptyMapState");

function render(){
  layer.clearLayers();
  const value=filter?.value||"all";
  const visibleReports = reports.filter(r=>value==="all"||value==="4plus"&&Number(r.severity)>=4||Number(r.severity)===Number(value));

  if(empty) empty.hidden = visibleReports.length > 0;

  visibleReports.forEach(r=>{
    const photo=r.photo_url?`<img class="popupPhoto" src="${r.photo_url}" alt="Foto zur Meldung">`:"";
    L.marker([r.lat,r.lng],{icon:markerIcon(r.severity)}).addTo(layer).bindPopup(
      `<strong>${escapeHtml(r.address)}</strong><br>Belastung: ${r.severity}/5<br>Seit: ${escapeHtml(r.since||"Unklar")}<br>${photo}${r.note?"<br>Bemerkung: "+escapeHtml(r.note):""}`
    );
  });
}
filter?.addEventListener("change",render);
render();
