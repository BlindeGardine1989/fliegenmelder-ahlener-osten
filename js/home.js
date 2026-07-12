import { supabase, escapeHtml, formatDate } from "./app.js";

const mapEl = document.querySelector("#map"),
      latestEl = document.querySelector("#latestReports"),
      filterEl = document.querySelector("#severityFilter");

const statTotal = document.querySelector("#statTotal"),
      statMonth = document.querySelector("#statMonth"),
      statAvg = document.querySelector("#statAvg"),
      statHotspots = document.querySelector("#statHotspots");

let map, layer, reports = [];

if (mapEl && window.L) {
    map = L.map(mapEl).setView([51.762, 7.91], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap-Mitwirkende"
    }).addTo(map);

    layer = L.layerGroup().addTo(map);
}

loadReports();
filterEl?.addEventListener("change", renderMap);
filterEl?.addEventListener("change",renderMap);
async function loadReports(){const {data,error}=await supabase.from("reports").select("*").eq("visible",true).order("created_at",{ascending:false});if(error){console.error(error);if(latestEl)latestEl.innerHTML='<div class="emptyState">Meldungen konnten nicht geladen werden.</div>';return}reports=data||[];renderStats();renderLatest();renderMap()}
function renderStats(){if(!statTotal)return;statTotal.textContent=reports.length;const now=new Date();const month=reports.filter(r=>{const d=new Date(r.created_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});statMonth.textContent=month.length;const s=reports.map(r=>Number(r.severity)).filter(Boolean);statAvg.textContent=s.length?(s.reduce((a,b)=>a+b,0)/s.length).toFixed(1):"–";statHotspots.textContent=reports.filter(r=>Number(r.severity)>=4).length}
function renderLatest(){if(!latestEl)return;const latest=reports.slice(0,5);if(!latest.length){latestEl.innerHTML='<div class="emptyState">Noch keine freigegebenen Meldungen vorhanden.</div>';return}latestEl.innerHTML=latest.map(r=>`<article class="latestItem"><span class="dot s${escapeHtml(r.severity||3)}"></span><div><strong>${escapeHtml(r.address||"Ahlener Osten")}</strong><br><small>${formatDate(r.created_at)}</small></div><small>${escapeHtml(r.severity||"–")}/5</small></article>`).join("")}
function renderMap(){if(!map||!layer)return;layer.clearLayers();const filter=filterEl?.value||"all";let shown=reports.filter(r=>r.lat&&r.lng);if(filter==="4plus")shown=shown.filter(r=>Number(r.severity)>=4);else if(filter!=="all")shown=shown.filter(r=>String(r.severity)===filter);for(const r of shown){const sev=Number(r.severity)||3;L.circleMarker([r.lat,r.lng],{radius:9,color:"#fff",weight:2,fillColor:color(sev),fillOpacity:.95}).bindPopup(`<strong>${escapeHtml(r.address||"Meldung")}</strong><br>Belastung: ${escapeHtml(sev)}/5<br>${escapeHtml(r.note||"")}`).addTo(layer)}}
function color(sev){return sev===1?"#2e7d32":sev===2?"#79bf5b":sev===3?"#f2b705":sev===4?"#ef7d00":"#d51f28"}
