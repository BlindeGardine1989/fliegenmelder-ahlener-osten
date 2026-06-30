# Patch: Startseite + Adminbereich

Diese Dateien ersetzen/hochladen:

- index.html
- css/style.css
- admin/index.html
- admin/admin.js
- admin-auth-policies.sql

Wichtig:
- Logo bleibt unverändert.
- Es wird überall `assets/logo.png` verwendet.
- `js/config.js` NICHT ersetzen.

Nach dem Hochladen:
1. In Supabase den SQL-Code aus `admin-auth-policies.sql` ausführen.
2. In Supabase unter Authentication → URL Configuration:
   - Site URL: https://fliegenmelder-ahlener-osten.pages.dev
   - Redirect URL: https://fliegenmelder-ahlener-osten.pages.dev/admin/
3. Danach Adminbereich öffnen:
   https://fliegenmelder-ahlener-osten.pages.dev/admin/
4. E-Mail eingeben: fliegenmelder.ahlen@gmail.com
5. Login-Link aus dem Mailpostfach anklicken.
