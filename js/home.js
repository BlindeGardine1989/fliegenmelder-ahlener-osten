import { loadPublicReports, escapeHtml, formatDate, markerIcon, mapDefaults } from "./app.js";

const reports = await loadPublicReports();

const mapEl = document.querySelector("#map");
if(mapEl){
  const map=L.map("map").setView([mapDefaults.ORT_LAT,mapDefaults.ORT_LNG],mapDefaults.START_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap-Mitwirkende"}).addTo(map);
  const layer=L.layerGroup().addTo(map);
  const filter=document.querySelector("#severityFilter");

  function render(){
    layer.clearLayers();
    const value=filter?.value||"all";
    const visibleReports = reports.filter(r=>value==="all"||value==="4plus"&&Number(r.severity)>=4||Number(r.severity)===Number(value));

    visibleReports.forEach(r=>{
      const photo=r.photo_url?`<img class="popupPhoto" src="${r.photo_url}" alt="Foto zur Meldung">`:"";
      L.marker([r.lat,r.lng],{icon:markerIcon(r.severity)}).addTo(layer).bindPopup(
        `<strong>${escapeHtml(r.address)}</strong><br>Belastung: ${r.severity}/5<br>Seit: ${escapeHtml(r.since||"Unklar")}<br>${photo}${r.note?"<br>Bemerkung: "+escapeHtml(r.note):""}`
      );
    });
  }

  filter?.addEventListener("change",render);
  render();
}

function setText(sel,val){const el=document.querySelector(sel);if(el)el.textContent=val}
const total=reports.length;
const hotspots=reports.filter(r=>Number(r.severity)>=4).length;
const avg=total?reports.reduce((s,r)=>s+Number(r.severity||0),0)/total:null;
const now=new Date();
const month=reports.filter(r=>{const d=new Date(r.created_at||Date.now());return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()}).length;

setText("#statTotal",total);
setText("#statMonth",month);
setText("#statAvg",avg?avg.toFixed(1):"–");
setText("#statHotspots",hotspots);

const latest=document.querySelector("#latestReports");
if(latest){
  latest.innerHTML="";
  if(!reports.length){
    latest.innerHTML = `<div class="emptyState">Noch keine freigegebenen Meldungen vorhanden.</div>`;
  } else {
    reports.slice(0,5).forEach(r=>{
      const item=document.createElement("div");
      item.className="latestItem";
      item.innerHTML=`<span class="dot s${Number(r.severity)}"></span><div><strong>${escapeHtml(r.address)}</strong><br><small>${formatDate(r.created_at)}</small></div><strong>${r.severity}/5</strong>`;
      latest.appendChild(item);
    });
  }
}
