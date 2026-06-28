# Fliegenmelder Ahlener Osten – Version 4

Supabase-URL ist bereits eingetragen.

## Du musst nur noch:

1. In `js/config.js` den Publishable Key einsetzen:
   `HIER_DEINEN_SB_PUBLISHABLE_KEY_EINTRAGEN`
2. Dateien zu GitHub hochladen.
3. Commit changes klicken.
4. Cloudflare veröffentlicht automatisch.

## Wichtig

Den Secret Key niemals in GitHub eintragen.


## Version 5 – Adminbereich

Neu:
- Meldungen im Adminbereich anzeigen
- Freigeben
- Zurück auf Prüfung setzen
- Ausblenden
- CSV exportieren

Nach dem Hochladen zu GitHub bitte zusätzlich in Supabase den SQL-Code ausführen:

`admin-policies-temp.sql`

Wichtig: Das ist eine Übergangslösung ohne Login. Später ersetzen wir das durch einen geschützten Admin-Login.
