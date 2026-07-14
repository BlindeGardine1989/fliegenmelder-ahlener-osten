import { supabase } from "./app.js";

import {
  ORT_LAT,
  ORT_LNG,
  START_ZOOM
} from "./config.js";


const form = document.querySelector("#reportForm");
const statusElement = document.querySelector("#status");

const addressInput = document.querySelector("#address");
const severityInput = document.querySelector("#severity");
const sinceInput = document.querySelector("#since");
const timeOfDayInput = document.querySelector("#time_of_day");
const noteInput = document.querySelector("#note");
const contactInput = document.querySelector("#contact");
const photoInput = document.querySelector("#photo");

const latInput = document.querySelector("#lat");
const lngInput = document.querySelector("#lng");

const privacyCheckbox = document.querySelector("#privacyConsent");
const submitButton = document.querySelector("#submitReport");
const gpsButton = document.querySelector("#useGps");


let selectedMarker = null;


function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}


function updateSubmitButton() {
  if (!submitButton || !privacyCheckbox) {
    return;
  }

  submitButton.disabled = !privacyCheckbox.checked;

  submitButton.setAttribute(
    "aria-disabled",
    String(!privacyCheckbox.checked)
  );
}


privacyCheckbox?.addEventListener(
  "change",
  updateSubmitButton
);

updateSubmitButton();


/* Karte */

const mapElement = document.querySelector("#map");

let map = null;

if (mapElement && window.L) {
  map = L.map(mapElement).setView(
    [ORT_LAT, ORT_LNG],
    START_ZOOM
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap-Mitwirkende"
    }
  ).addTo(map);

  map.on("click", event => {
    setLocation(
      event.latlng.lat,
      event.latlng.lng,
      "Ausgewählter Standort"
    );
  });
} else {
  console.error("Die Karte konnte nicht initialisiert werden.");
}


function setLocation(lat, lng, label) {
  if (latInput) {
    latInput.value = String(lat);
  }

  if (lngInput) {
    lngInput.value = String(lng);
  }

  if (!map) {
    return;
  }

  if (selectedMarker) {
    selectedMarker.remove();
  }

  selectedMarker = L
    .marker([lat, lng])
    .addTo(map)
    .bindPopup(label)
    .openPopup();
}


gpsButton?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus(
      "Die Standortermittlung wird von diesem Gerät nicht unterstützt."
    );

    return;
  }

  setStatus("Standort wird ermittelt …");

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setLocation(
        lat,
        lng,
        "Aktueller Standort"
      );

      map?.setView([lat, lng], 17);

      setStatus("Standort wurde übernommen.");
    },

    error => {
      console.error(error);

      setStatus(
        "Der Standort konnte nicht ermittelt werden. Bitte wählen Sie den Standort auf der Karte aus."
      );
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
});


/* Bild verkleinern */

async function compressImage(
  file,
  maxWidth = 1400,
  quality = 0.72
) {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    maxWidth / bitmap.width
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.round(
    bitmap.width * scale
  );

  canvas.height = Math.round(
    bitmap.height * scale
  );

  const context = canvas.getContext("2d");

  context.drawImage(
    bitmap,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("Das Bild konnte nicht verarbeitet werden.")
          );
        }
      },
      "image/jpeg",
      quality
    );
  });
}


/* Formular absenden */

form?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!privacyCheckbox?.checked) {
    setStatus(
      "Bitte bestätigen Sie zuerst die Datenschutzerklärung."
    );

    updateSubmitButton();
    return;
  }

  const address = addressInput?.value.trim() || "";
  const severity = Number(severityInput?.value || 3);
  const since = sinceInput?.value.trim() || "";
  const timeOfDay = timeOfDayInput?.value.trim() || "";
  const note = noteInput?.value.trim() || "";
  const contactPrivate = contactInput?.value.trim() || "";

  const lat = Number(latInput?.value);
  const lng = Number(lngInput?.value);

  if (!address) {
    setStatus(
      "Bitte geben Sie eine Straße und Hausnummer ein."
    );

    addressInput?.focus();
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setStatus(
      "Bitte wählen Sie den Standort auf der Karte aus oder verwenden Sie GPS."
    );

    return;
  }

  if (
    !Number.isFinite(severity) ||
    severity < 1 ||
    severity > 5
  ) {
    setStatus(
      "Bitte wählen Sie eine gültige Belastungsstufe aus."
    );

    return;
  }

  submitButton.disabled = true;

  const publicId = crypto.randomUUID();
  let photoPath = null;

  try {
    const file = photoInput?.files?.[0];

    if (file) {
      setStatus(
        "Das Foto wird verarbeitet und hochgeladen …"
      );

      const compressedImage = await compressImage(
        file,
        1400,
        0.72
      );

      photoPath = `${publicId}.jpg`;

      const { error: uploadError } =
        await supabase.storage
          .from("report-photos")
          .upload(
            photoPath,
            compressedImage,
            {
              contentType: "image/jpeg",
              upsert: false
            }
          );

      if (uploadError) {
        throw uploadError;
      }
    }

    setStatus("Die Meldung wird gespeichert …");

    const report = {
      public_id: publicId,
      address,
      severity,
      since,
      time_of_day: timeOfDay,
      note,
      contact_private: contactPrivate,
      lat,
      lng,
      photo_path: photoPath,
      status: "pending",
      visible: false,
      client_timestamp: new Date().toISOString()
    };

    const { error } = await supabase
      .from("reports")
      .insert(report);

    if (error) {
      throw error;
    }

    form.reset();
    updateSubmitButton();

    if (selectedMarker) {
      selectedMarker.remove();
      selectedMarker = null;
    }

    if (latInput) {
      latInput.value = "";
    }

    if (lngInput) {
      lngInput.value = "";
    }

    setStatus(
      `Vielen Dank. Ihre Meldung ${publicId.slice(0, 8)} wurde gespeichert und wird geprüft.`
    );
  } catch (error) {
    console.error(
      "Meldung konnte nicht gespeichert werden:",
      error
    );

    setStatus(
      "Die Meldung konnte leider nicht gespeichert werden. Bitte versuchen Sie es später erneut."
    );

    updateSubmitButton();
  }
});
