const privacyConsent = document.querySelector("#privacyConsent");
const submitReport = document.querySelector("#submitReport");

function updatePrivacyButton() {
  if (submitReport) submitReport.disabled = !privacyConsent?.checked;
}

privacyConsent?.addEventListener("change", updatePrivacyButton);
updatePrivacyButton();
