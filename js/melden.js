import { supabase } from "./app.js";

const form = document.querySelector("#reportForm");
const statusElement = document.querySelector("#status");
const privacyCheckbox = document.querySelector("#privacyConsent");
const submitButton = document.querySelector("#submitReport");

function updateSubmitButton() {
  if (!privacyCheckbox || !submitButton) {
    return;
  }

  submitButton.disabled = !privacyCheckbox.checked;
  submitButton.setAttribute(
    "aria-disabled",
    String(!privacyCheckbox.checked)
  );
}

if (!form) {
  console.error("Das Meldeformular #reportForm wurde nicht gefunden.");
}

if (!privacyCheckbox) {
  console.error(
    "Die Datenschutz-Checkbox #privacyConsent wurde nicht gefunden."
  );
}

if (!submitButton) {
  console.error(
    "Der Absende-Button #submitReport wurde nicht gefunden."
  );
}

privacyCheckbox?.addEventListener("change", updateSubmitButton);

updateSubmitButton();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!privacyCheckbox?.checked) {
    if (statusElement) {
      statusElement.textContent =
        "Bitte bestätigen Sie zuerst die Datenschutzerklärung.";
    }

    updateSubmitButton();
    return;
  }

  const formData = new FormData(form);

  const address = String(formData.get("address") || "").trim();
  const severity = Number(formData.get("severity"));
  const since = String(formData.get("since") || "").trim();
  const timeOfDay = String(formData.get("time_of_day") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const contactPrivate = String(
    formData.get("contact_private") || ""
  ).trim();

  if (!address) {
    if (statusElement) {
      statusElement.textContent =
        "Bitte geben Sie eine Straße oder einen Bereich an.";
    }

    return;
  }

  if (!Number.isFinite(severity) || severity < 1 || severity > 5) {
    if (statusElement) {
      statusElement.textContent =
        "Bitte wählen Sie eine gültige Belastungsstufe aus.";
    }

    return;
  }

  submitButton.disabled = true;

  if (statusElement) {
    statusElement.textContent = "Meldung wird gespeichert …";
  }

  const publicId = crypto.randomUUID();

  const payload = {
    public_id: publicId,
    address,
    severity,
    since,
    time_of_day: timeOfDay,
    note,
    contact_private: contactPrivate,
    status: "pending",
    visible: false,
    client_timestamp: new Date().toISOString()
  };

  const { error } = await supabase
    .from("reports")
    .insert(payload);

  if (error) {
    console.error("Meldung konnte nicht gespeichert werden:", error);

    if (statusElement) {
      statusElement.textContent =
        "Die Meldung konnte leider nicht gespeichert werden. Bitte versuchen Sie es später erneut.";
    }

    updateSubmitButton();
    return;
  }

  if (statusElement) {
    statusElement.textContent =
      `Vielen Dank! Ihre Meldung ${publicId.slice(0, 8)} wurde eingereicht und wird geprüft.`;
  }

  form.reset();
  updateSubmitButton();
});
