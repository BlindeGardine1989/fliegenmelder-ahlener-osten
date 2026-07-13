const topbar = document.querySelector(".topbar");
const nav = document.querySelector(".nav");

if (topbar && nav) {
  const menuItems = [
    { href: "index.html", label: "Startseite" },
    { href: "melden.html", label: "Fliegen melden" },
    { href: "karte.html", label: "Meldungskarte" },
    { href: "wissenswertes.html", label: "Wissenswertes" },
    { href: "neuigkeiten.html", label: "Neuigkeiten" },
    { href: "chronik.html", label: "Chronik" },
    { href: "dokumente.html", label: "Dokumente" },
    { href: "termine.html", label: "Termine" },
    { href: "ueber-uns.html", label: "Über uns" },
    { href: "kontakt.html", label: "Kontakt" }
  ];

  const currentFile =
    window.location.pathname.split("/").pop() || "index.html";

  nav.innerHTML = menuItems
    .map((item) => {
      const isCurrent = currentFile === item.href;

      return `
        <a
          href="${item.href}"
          ${isCurrent ? 'aria-current="page"' : ""}
        >
          ${item.label}
        </a>
      `;
    })
    .join("");

  nav.insertAdjacentHTML(
    "beforeend",
    `
      <a class="buttonLink" href="melden.html">
        + Meldung einreichen
      </a>
    `
  );

  if (!document.querySelector(".menuToggle")) {
    const button = document.createElement("button");

    button.className = "menuToggle";
    button.type = "button";
    button.setAttribute("aria-label", "Menü öffnen");
    button.setAttribute("aria-expanded", "false");

    button.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    topbar.insertBefore(button, nav);

    button.addEventListener("click", () => {
      const isOpen = topbar.classList.toggle("menuOpen");

      button.setAttribute(
        "aria-expanded",
        String(isOpen)
      );

      button.setAttribute(
        "aria-label",
        isOpen ? "Menü schließen" : "Menü öffnen"
      );
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        topbar.classList.remove("menuOpen");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Menü öffnen");
      });
    });
  }
