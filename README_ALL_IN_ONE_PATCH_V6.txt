# All-in-one Patch V6

Enthalten:
- neues, schlichtes Logo
- Demo-Meldungen entfernt
- Karte zeigt nur echte freigegebene Meldungen
- Admin-Zugang über Footer: "Interner Bereich"
- Admin-Login per Supabase E-Mail-Link
- bessere Handy-Optimierung
- optisch verbesserte Karte/Startseite

Wichtig:
Die Datei `js/config.js` ist absichtlich NICHT enthalten.
Bitte diese Datei nicht ersetzen, weil dort dein Supabase Publishable Key steht.

Nach dem Hochladen:
1. In Supabase `admin-auth-policies.sql` ausführen.
2. Supabase Authentication → URL Configuration:
   Site URL: https://fliegenmelder-ahlener-osten.pages.dev
   Redirect URL: https://fliegenmelder-ahlener-osten.pages.dev/admin/
