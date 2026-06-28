# Fliegenmelder Ahlener Osten – Version 3

Diese Version enthält:

- neues rundes Logo
- Startseite
- Meldungsformular
- Karte
- Neuigkeiten
- Termine
- Dokumente
- Über uns
- Kontakt
- Impressum / Datenschutz
- Admin-Grundlage
- Supabase-Vorbereitung

## Aktualisierung auf GitHub

1. ZIP entpacken.
2. Alle Dateien und Ordner in GitHub hochladen.
3. Commit changes klicken.
4. Cloudflare veröffentlicht automatisch neu.

## Supabase verbinden

In `js/config.js` eintragen:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `IS_CONFIGURED = true`

Dann in Supabase den SQL-Code aus `supabase-schema.sql` ausführen.

## Wichtige Hinweise

- Secret Key niemals veröffentlichen.
- Kontaktdaten nicht öffentlich anzeigen.
- Adminbereich muss später mit Auth abgesichert werden.
