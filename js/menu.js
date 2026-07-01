const topbar = document.querySelector(".topbar");
const nav = document.querySelector(".nav");

if (topbar && nav && !document.querySelector(".menuToggle")) {
  const button = document.createElement("button");
  button.className = "menuToggle";
  button.type = "button";
  button.setAttribute("aria-label", "Menü öffnen");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = "<span></span><span></span><span></span>";

  topbar.insertBefore(button, nav);

  button.addEventListener("click", () => {
    const isOpen = topbar.classList.toggle("menuOpen");
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? "Menü schließen" : "Menü öffnen");
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      topbar.classList.remove("menuOpen");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Menü öffnen");
    });
  });
}