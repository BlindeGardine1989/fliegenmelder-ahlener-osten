const footer = document.querySelector(".siteFooter");

if (footer) {
  footer.innerHTML = `
    <h2>Fliegenmelder Ahlener Osten</h2>

    <p>
      <span data-setting="footer_line_1">
        Gemeinsam gegen die Fliegenplage.
      </span>
    </p>

    <p>
      <strong>
        <span data-setting="footer_line_2">
          Die Informationsplattform für die Fliegenplage im Ahlener Osten.
        </span>
      </strong>
    </p>

    <p>
      <em>
        Ein ehrenamtliches Projekt der Bürgerinitiative Ahlener Osten.
      </em>
    </p>

    <p>
      <span data-setting="footer_line_3">
        Für eine lebenswerte Zukunft im Ahlener Osten.
      </span>
    </p>

    <nav>
      <a href="faq.html">FAQ</a>
      <a href="impressum.html">Impressum</a>
      <a href="datenschutz.html">Datenschutz</a>
      <a href="kontakt.html">Kontakt</a>
      <a href="admin.html">Interner Bereich</a>
    </nav>
  `;
}
