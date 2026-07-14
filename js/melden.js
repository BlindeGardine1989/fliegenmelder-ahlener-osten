import {
  supabase,
  compressImage,
  mapDefaults
} from "./app.js";

import {
  IS_CONFIGURED,
  SUPABASE_PUBLISHABLE_KEY
} from "./config.js";


const form = document.querySelector("#reportForm");
const status = document.querySelector("#status");

const privacyCheckbox = form?.querySelector(
  [
    "#privacyConsent",
    "#datenschutz",
    "#privacy",
    'input[name="privacy"]',
    'input[name="datenschutz"]',
    'input[name="privacyConsent"]',
    'input[type="checkbox"][required]'
  ].join(", ")
);

const submitButton = form?.querySelector(
  'button[type="submit"], input[type="submit"]'
);


/* Karte einrichten */

const map = L.map("map").setView(
  [
    mapDefaults.ORT_LAT,
    mapDefaults.ORT_LNG
  ],
  mapDefaults.START_ZOOM
);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap-Mitwirkende"
  }
).addTo(map);

let selectedMarker = null;


function setLocation(lat, lng, label) {
  const latInput = document.querySelector("#lat");
  const lngInput = document.querySelector("#lng");

  if (latInput) {
    latInput.value = lat;
  }

  if (lngInput) {
    lngInput.value = lng;
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


map.on("click", event => {
  setLocation(
    event.latlng.lat,
    event.latlng.lng,
    "Ausgewählter Standort"
  );
});


document
  .querySelector("#useGps")
  ?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      if (status) {
        status.textContent = "GPS wird nicht unterstützt.";
      }

      return;
    }

    if (status) {
      status.textContent = "Standort wird ermittelt ...";
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLocation(lat, lng, "Aktueller Standort");
        map.setView([lat, lng], 17);

        if (status) {
          status.textContent = "Standort übernommen.";
        }
      },
      () => {
        if (status) {
          status.textContent =
            "Standort konnte nicht ermittelt werden.";
        }
      }
    );
  });


/* Datenschutz-Checkbox und Absende-Button */

function updateSubmitButton() {
  if (!submitButton) {
    return;
  }

  const accepted = privacyCheckbox?.checked === true;

  submitButton.disabled = !accepted;
  submitButton.setAttribute(
    "aria-disabled",
    String(!accepted)
  );
}


if (!privacyCheckbox) {
  console.error(
    "Datenschutz-Checkbox wurde im Formular nicht gefunden."
  );
}

if (!submitButton) {
  console.error(
    "Absende-Button wurde im Formular nicht gefunden."
  );
}

if (privacyCheckbox && submitButton) {
  updateSubmitButton();

  privacyCheckbox.addEventListener(
    "change",
    updateSubmitButton
  );
}


/* Meldung absenden */

form?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!privacyCheckbox?.checked) {
    if (status) {
      status.textContent =
        "Bitte bestätige zuerst die Datenschutzerklärung.";
    }

    updateSubmitButton();
    return;
  }

  const lat = Number(
    document.querySelector("#lat")?.value
  );

  const lng = Number(
    document.querySelector("#lng")?.value
  );

  if (!lat || !lng) {
    if (status) {
      status.textContent =
        "Bitte Standort per Karte oder GPS auswählen.";
    }

    return;
  }

  if (
    !IS_CONFIGURED ||
    SUPABASE_PUBLISHABLE_KEY.includes("HIER_DEINEN")
  ) {
    if (status) {
      status.textContent =
        "Publishable Key fehlt noch in js/config.js.";
    }

    return;
  }

  if (status) {
    status.textContent = "Meldung wird gespeichert ...";
  }

  const publicId = crypto.randomUUID();
  let photoPath = null;

  try {
    const file =
      document.querySelector("#photo")?.files?.[0];

    if (file) {
      if (status) {
        status.textContent =
          "Foto wird verkleinert und hochgeladen ...";
      }

      const compressed = await compressImage(
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
            compressed,
            {
              contentType: "image/jpeg",
              upsert: false
            }
          );

      if (uploadError) {
        throw uploadError;
      }
    }

    const payload = {
      public_id: publicId,

      address:
        document
          .querySelector("#address")
          ?.value
          .trim() || "",

      severity: Number(
        document.querySelector("#severity")?.value
      ),

      since:
        document.querySelector("#since")?.value || "",

      time_of_day:
        document.querySelector("#time_of_day")?.value || "",

      note:
        document
          .querySelector("#note")
          ?.value
          .trim() || "",

      contact_private:
        document
          .querySelector("#contact")
          ?.value
          .trim() || "",

      lat,
      lng,
      photo_path: photoPath,
      status: "pending",
      visible: false,
      client_timestamp: new Date().toISOString()
    };

    const { error } = await supabase
      .from("reports")
      .insert(payload);

    if (error) {
      throw error;
    }

    if (status) {
      status.textContent =
        `Danke! Meldung ${publicId.slice(0, 8)} wurde eingereicht und wird geprüft.`;
    }

    form.reset();
    updateSubmitButton();

    if (selectedMarker) {
      selectedMarker.remove();
      selectedMarker = null;
    }
  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent =
        "Fehler beim Speichern. Bitte Supabase-Tabellen, Storage und Richtlinien prüfen.";
    }
  }
});
