/* Røntgenprosedyrer – applikasjonslogikk */
(function () {
  "use strict";

  const nav = document.getElementById("nav");
  const searchInput = document.getElementById("search");
  const btnVoksen = document.getElementById("btn-voksen");
  const btnBarn = document.getElementById("btn-barn");
  const segmented = document.querySelector(".segmented");
  const brandSubtitle = document.getElementById("brand-subtitle");

  const toolbar = document.getElementById("viewer-toolbar");
  const viewerCategory = document.getElementById("viewer-category");
  const viewerProcedure = document.getElementById("viewer-procedure");
  const openExternal = document.getElementById("open-external");
  const emptyState = document.getElementById("empty-state");
  const loading = document.getElementById("loading");
  const pdfFrame = document.getElementById("pdf-frame");

  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = themeToggle.querySelector(".theme-icon");
  const themeLabel = themeToggle.querySelector(".theme-label");

  // Tilstand
  let gruppe = localStorage.getItem("gruppe") || "voksen"; // "voksen" | "barn"
  let openCategories = new Set();
  let activeUrl = null;

  /* ---------- Tema ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    const dark = theme === "dark";
    themeIcon.textContent = dark ? "☀️" : "🌙";
    themeLabel.textContent = dark ? "Lys modus" : "Mørk modus";
  }

  const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(savedTheme);

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  /* ---------- Voksen / Barn ---------- */

  function setGruppe(g) {
    gruppe = g;
    localStorage.setItem("gruppe", g);
    const barn = g === "barn";
    segmented.classList.toggle("barn", barn);
    btnVoksen.classList.toggle("active", !barn);
    btnBarn.classList.toggle("active", barn);
    btnVoksen.setAttribute("aria-selected", String(!barn));
    btnBarn.setAttribute("aria-selected", String(barn));
    brandSubtitle.textContent = barn ? "Barn" : "Voksen";
    render();
  }

  btnVoksen.addEventListener("click", () => setGruppe("voksen"));
  btnBarn.addEventListener("click", () => setGruppe("barn"));

  /* ---------- Søk ---------- */

  let searchTerm = "";
  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    render();
  });

  function highlight(text) {
    if (!searchTerm) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(searchTerm);
    if (idx === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      "<mark>" + escapeHtml(text.slice(idx, idx + searchTerm.length)) + "</mark>" +
      escapeHtml(text.slice(idx + searchTerm.length))
    );
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  /* ---------- Navigasjon ---------- */

  function render() {
    nav.innerHTML = "";
    let anyResult = false;

    for (const kat of PROSEDYRE_DATA.kategorier) {
      const alle = kat[gruppe] || [];
      const prosedyrer = searchTerm
        ? alle.filter((p) => p.navn.toLowerCase().includes(searchTerm))
        : alle;

      // Skjul tomme kategorier ved søk; vis tomme kategorier ellers ikke heller
      if (prosedyrer.length === 0) continue;
      anyResult = true;

      const open = searchTerm ? true : openCategories.has(kat.id);

      const catEl = document.createElement("div");
      catEl.className = "category" + (open ? " open" : "");

      const catBtn = document.createElement("button");
      catBtn.className = "category-btn";
      catBtn.innerHTML =
        '<span class="category-icon">' + kat.ikon + "</span>" +
        '<span class="category-name">' + escapeHtml(kat.navn) + "</span>" +
        '<span class="category-count">' + prosedyrer.length + "</span>" +
        '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>';
      catBtn.addEventListener("click", () => {
        if (openCategories.has(kat.id)) openCategories.delete(kat.id);
        else openCategories.add(kat.id);
        render();
      });
      catEl.appendChild(catBtn);

      const list = document.createElement("div");
      list.className = "procedures";
      for (const p of prosedyrer) {
        const pBtn = document.createElement("button");
        pBtn.className = "procedure-btn" + (p.url === activeUrl ? " active" : "");
        pBtn.innerHTML = highlight(p.navn);
        pBtn.addEventListener("click", () => openProcedure(kat, p));
        list.appendChild(pBtn);
      }
      catEl.appendChild(list);
      nav.appendChild(catEl);
    }

    if (!anyResult) {
      const msg = document.createElement("div");
      msg.className = "no-results";
      msg.textContent = searchTerm
        ? "Ingen prosedyrer samsvarer med «" + searchInput.value.trim() + "»."
        : "Ingen prosedyrer i denne gruppen ennå.";
      nav.appendChild(msg);
    }
  }

  /* ---------- Åpne prosedyre ---------- */

  function openProcedure(kat, p) {
    activeUrl = p.url;

    viewerCategory.textContent = kat.navn;
    viewerProcedure.textContent = p.navn;
    openExternal.href = p.url;
    toolbar.classList.remove("hidden");

    emptyState.classList.add("hidden");
    loading.classList.remove("hidden");
    pdfFrame.classList.remove("hidden");

    pdfFrame.onload = () => loading.classList.add("hidden");
    pdfFrame.src = p.url;

    // Fallback: skjul lastindikatoren etter en stund selv om onload aldri fyrer
    setTimeout(() => loading.classList.add("hidden"), 8000);

    render(); // oppdater aktiv markering
  }

  /* ---------- Init ---------- */

  // Åpne første kategori som standard, og sett riktig gruppe
  if (PROSEDYRE_DATA.kategorier.length > 0) {
    openCategories.add(PROSEDYRE_DATA.kategorier[0].id);
  }
  setGruppe(gruppe);
})();
