import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
export function formatDate(value) {
  if (!value) return "–";

  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
const reportForm = document.querySelector("#reportForm");
const status = document.querySelector("#status");
const privacyConsent = document.querySelector("#privacyConsent");
const submitReport = document.querySelector("#submitReport");

function setStatus(message) {
  if (status) status.textContent = message;
}

function updateSubmitState() {
  if (!submitReport) return;
  if (privacyConsent) {
    submitReport.disabled = !privacyConsent.checked;
  }
}

privacyConsent?.addEventListener("change", updateSubmitState);
updateSubmitState();

reportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (privacyConsent && !privacyConsent.checked) {
    setStatus("Bitte bestätigen Sie die Datenschutzerklärung.");
    return;
  }

  setStatus("Meldung wird gespeichert ...");

  const formData = new FormData(reportForm);

  const report = {
    address: String(formData.get("address") || "").trim(),
    severity: Number(formData.get("severity") || 3),
    since: String(formData.get("since") || "").trim(),
    time_of_day: String(formData.get("time_of_day") || "").trim(),
    note: String(formData.get("note") || "").trim(),
    contact_private: String(formData.get("contact_private") || "").trim(),
    status: "pending",
    visible: false
  };

  if (!report.address) {
    setStatus("Bitte Straße und Hausnummer eintragen.");
    return;
  }

  const { error } = await supabase
    .from("reports")
    .insert(report);

  if (error) {
    console.error(error);
    setStatus("Meldung konnte nicht gespeichert werden. Bitte später erneut versuchen.");
    return;
  }

  reportForm.reset();
  updateSubmitState();
  setStatus("Vielen Dank. Ihre Meldung wurde gespeichert und wird geprüft.");
});
