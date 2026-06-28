import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ORT_LAT, ORT_LNG, START_ZOOM, IS_CONFIGURED } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function formatDate(value){
  return value
    ? new Intl.DateTimeFormat("de-DE",{dateStyle:"short",timeStyle:"short"}).format(new Date(value))
    : "–";
}

export async function compressImage(file,maxWidth=1400,quality=.72){
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1,maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
  return await new Promise(resolve => canvas.toBlob(resolve,"image/jpeg",quality));
}

export function markerIcon(severity){
  return L.divIcon({
    className:"",
    html:`<span class="marker-dot s${Number(severity || 1)}"></span>`,
    iconSize:[22,22],
    iconAnchor:[11,11]
  });
}

export const mapDefaults = { ORT_LAT, ORT_LNG, START_ZOOM, IS_CONFIGURED };

export async function loadPublicReports(){
  if (!IS_CONFIGURED || SUPABASE_PUBLISHABLE_KEY.includes("HIER_DEINEN")) return [];

  const { data, error } = await supabase
    .from("reports_public")
    .select("*")
    .order("created_at",{ascending:false});

  if (error) {
    console.warn("Meldungen konnten nicht geladen werden:", error);
    return [];
  }

  return data || [];
}
