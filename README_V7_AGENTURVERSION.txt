# Fliegenmelder Ahlener Osten – V7 Agenturversion

Enthalten:
- neues Logo nach gewünschtem runden Stil, aber sauberer umgesetzt
- neues Favicon
- Admin-Zugang über Footer: "Interner Bereich"
- Admin-Login per Supabase E-Mail-Link
- Demo-Meldungen entfernt
- Karte verbessert
- Handy-Optimierung
- Startseite optisch verbessert

Wichtig:
Die Datei `js/config.js` ist absichtlich NICHT enthalten.
Diese Datei bitte nicht ersetzen, weil dort dein Supabase Publishable Key steht.

Nach dem Hochladen:
1. In Supabase `admin-auth-policies.sql` ausführen.
2. In Supabase unter Authentication → URL Configuration eintragen:
   Site URL: https://fliegenmelder-ahlener-osten.pages.dev
   Redirect URL: https://fliegenmelder-ahlener-osten.pages.dev/admin/
