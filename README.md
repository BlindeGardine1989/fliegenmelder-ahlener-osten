# Fliegenmelder Ahlener Osten – Version 1

Dies ist das erste echte Starterpaket für die Webseite.

## Enthalten

- Startseite im Design der Demo
- eigenes schlichtes SVG-Logo
- Karte mit Pins
- Meldeformular
- GPS oder Kartenklick
- optional 1 Foto
- Statistik-Kacheln
- Aktuelles-/Über-uns-/Kontaktbereiche
- Admin-Seite als Grundlage
- CSV-Export
- Supabase-Schema
- Datenschutz- und Impressumsplatzhalter

## Kostenarmes Setup

- Cloudflare Pages: Webseite hosten
- Supabase Free: Meldungen und optionales Foto speichern
- WD PR4100: nur Backup, nicht öffentlich erreichbar

## Einrichtung

1. Supabase-Projekt erstellen.
2. In Supabase den SQL Editor öffnen.
3. Inhalt aus `supabase-schema.sql` ausführen.
4. Storage-Bucket `report-photos` erstellen.
5. Bucket für den Start public setzen.
6. In `config.js` Supabase URL und anon key eintragen.
7. `ORT_LAT` und `ORT_LNG` bei Bedarf genauer auf den Ahlener Osten setzen.
8. Dateien über Cloudflare Pages veröffentlichen.

## Wichtige Hinweise

- Das Admin-Panel ist als Grundlage enthalten, muss für den echten Betrieb aber noch mit Supabase Auth geschützt werden.
- Für den Anfang können Meldungen direkt in Supabase freigegeben werden:
  - `status = approved`
  - `visible = true`
- Keine privaten WhatsApp-Namen, Telefonnummern oder Adressen ungeprüft veröffentlichen.
- Datenschutz und Impressum vor Veröffentlichung sauber ergänzen.

## Nächster Entwicklungsschritt

- Admin-Login mit Supabase Auth
- sichere Freigabe direkt in der Admin-Oberfläche
- richtige Foto-URLs im Public View
- Aktuelles/Dokumente als editierbare Inhalte
