/* Røntgenprosedyrer – applikasjonslogikk.
   Data leses fra prosedyrer_rontgen.json. Prosedyrene åpnes i ett felles
   dokumentvindu i full skjermstørrelse, som gjenbrukes for hvert valg. */
(function () {
  "use strict";

  const grid = document.getElementById("grid");
  const noResults = document.getElementById("no-results");
  const searchInput = document.getElementById("search");
  const netBanner = document.getElementById("net-banner");
  const netRetry = document.getElementById("net-retry");
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = themeToggle.querySelector(".theme-icon");

  // Tilstand
  let searchTerm = "";
  let activeUrl = null;

  // Nettstatus mot sykehusets dokumentserver:
  // "ukjent" | "tilkoblet" | "frakoblet"
  let nettStatus = "ukjent";
  let probeUrl = null;

  // Kategorier slått sammen på tvers av pasienttype:
  // { navn, ikon, admin, voksen: [], barn: [] }
  let KATEGORIER = [];

  /* ---------- Tema ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(savedTheme);

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  /* ---------- Ikoner og bilder per kategori ---------- */

  // Nedskalerte utgaver av bildene i kategorier/ (lages av IT/vedlikeholder;
  // se README). Kategorier uten bilde faller tilbake til emoji-ikonet.
  const BILDER = {
    "Caput": "kategorier/thumbs/Caput.png",
    "Thorax / Abdomen": "kategorier/thumbs/Thorax Abdomen.png",
    "Columna": "kategorier/thumbs/Columna.png",
    "Bekken": "kategorier/thumbs/Bekken.png",
    "Overekstremitet": "kategorier/thumbs/Overekstremitet.png",
    "Underekstremitet": "kategorier/thumbs/Underekstremitet.png"
  };

  function iconFor(navn, admin) {
    if (admin) return "📋";
    const n = navn.toLowerCase();
    if (n.includes("caput") || n.includes("hode")) return "🧠";
    if (n.includes("thorax") || n.includes("abdomen")) return "🫁";
    if (n.includes("columna")) return "🦴";
    if (n.includes("bekken") || n.includes("hofte")) return "🩻";
    if (n.includes("overekstremitet")) return "💪";
    if (n.includes("underekstremitet")) return "🦵";
    if (n.includes("spesial")) return "🔬";
    return "🩻";
  }

  /* ---------- Datainnlasting ---------- */

  function buildModel(data) {
    const perNavn = new Map();
    for (const entry of data.rontgen || []) {
      const admin = entry.type === "administrativ";
      let kat = perNavn.get(entry.kategori);
      if (!kat) {
        kat = {
          navn: entry.kategori,
          ikon: iconFor(entry.kategori, admin),
          admin: admin,
          voksen: [],
          barn: []
        };
        perNavn.set(entry.kategori, kat);
        KATEGORIER.push(kat);
      }
      const liste = entry.pasienttype === "barn" ? kat.barn : kat.voksen;
      liste.push.apply(liste, entry.prosedyrer || []);

      for (const p of entry.prosedyrer || []) {
        if (!probeUrl && p.url.includes("sykehuspartner.no")) probeUrl = p.url;
      }
    }
    // Administrative kategorier legges sist
    KATEGORIER.sort((a, b) => Number(a.admin) - Number(b.admin));
  }

  fetch("prosedyrer_rontgen.json")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      buildModel(data);
      render();
      probeNett();
      setInterval(probeNett, 45000); // sjekk jevnlig, f.eks. ved bytte til VPN
    })
    .catch((err) => {
      noResults.textContent =
        "Kunne ikke laste prosedyrelisten (" + String(err.message || err) + "). " +
        "Hvis du åpnet siden direkte fra en fil, må den i stedet åpnes via en webserver.";
      noResults.classList.remove("hidden");
    });

  /* ---------- Nettsjekk mot dokumentserveren ---------- */

  function probeNett() {
    if (!probeUrl) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch(probeUrl, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: ctrl.signal })
      .then(() => { nettStatus = "tilkoblet"; })
      .catch(() => { nettStatus = "frakoblet"; })
      .finally(() => {
        clearTimeout(timer);
        netBanner.classList.toggle("hidden", nettStatus !== "frakoblet");
      });
  }

  netRetry.addEventListener("click", probeNett);

  /* ---------- Dokumentvindu ---------- */

  /* Åpner (eller gjenbruker) dokumentvinduet i full skjermstørrelse.
     Samme navngitte vindu navigeres på nytt for hver prosedyre, så det blir
     aldri mer enn ett. Ekte fullskjerm (F11) kan ikke startes utenfra av
     sikkerhetsgrunner, men vinduet fyller hele den tilgjengelige skjermen. */
  function apneDokumentvindu(url) {
    const vindu = window.open(
      url,
      "prosedyreVindu",
      "popup=yes,width=" + screen.availWidth + ",height=" + screen.availHeight + ",left=0,top=0"
    );
    if (vindu) vindu.focus();
    else window.open(url, "_blank"); // popup blokkert – fall tilbake til fane
  }

  function velgProsedyre(p) {
    if (nettStatus === "frakoblet") {
      // Ingen kontakt med serveren – pek på varselet i stedet for å åpne
      netBanner.classList.remove("hidden", "pulse");
      void netBanner.offsetWidth; // restart animasjonen
      netBanner.classList.add("pulse");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    activeUrl = p.url;
    apneDokumentvindu(p.url);
    render(); // oppdater aktiv markering
  }

  /* ---------- Søk ---------- */

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

  /* ---------- Rendering ---------- */

  function lagKolonne(type, label, prosedyrer) {
    const col = document.createElement("div");
    col.className = "col";

    const head = document.createElement("div");
    head.className = "col-label " + type;
    head.innerHTML = '<span class="dot"></span>' + label;
    col.appendChild(head);

    if (prosedyrer.length === 0) {
      const tom = document.createElement("div");
      tom.className = "col-tom";
      tom.textContent = "Ingen treff";
      col.appendChild(tom);
      return col;
    }

    for (const p of prosedyrer) {
      const btn = document.createElement("button");
      btn.className = "procedure-btn" + (p.url === activeUrl ? " active" : "");
      btn.innerHTML = highlight(p.navn);
      btn.title = "Åpne i dokumentvinduet";
      btn.addEventListener("click", () => velgProsedyre(p));
      col.appendChild(btn);
    }
    return col;
  }

  function render() {
    grid.innerHTML = "";
    let antallTreff = 0;

    for (const kat of KATEGORIER) {
      const voksen = searchTerm
        ? kat.voksen.filter((p) => p.navn.toLowerCase().includes(searchTerm))
        : kat.voksen;
      const barn = searchTerm
        ? kat.barn.filter((p) => p.navn.toLowerCase().includes(searchTerm))
        : kat.barn;

      const antall = voksen.length + barn.length;
      if (antall === 0) continue; // skjul kort uten treff
      antallTreff += antall;

      const card = document.createElement("section");
      card.className = "card";

      const head = document.createElement("header");
      head.className = "card-head";
      const bilde = BILDER[kat.navn];
      head.innerHTML =
        (bilde
          ? '<span class="card-img-wrap"><img class="card-img" src="' +
            encodeURI(bilde) + '" alt="" loading="lazy"></span>'
          : '<span class="card-icon">' + kat.ikon + "</span>") +
        '<span class="card-name">' + escapeHtml(kat.navn) + "</span>" +
        '<span class="card-count">' + antall + "</span>";
      card.appendChild(head);

      const cols = document.createElement("div");
      const harVoksen = kat.voksen.length > 0;
      const harBarn = kat.barn.length > 0;

      if (kat.admin) {
        cols.className = "card-cols single";
        cols.appendChild(lagKolonne("felles", "Felles", voksen.concat(barn)));
      } else if (harVoksen && harBarn) {
        cols.className = "card-cols";
        cols.appendChild(lagKolonne("voksen", "Voksen", voksen));
        cols.appendChild(lagKolonne("barn", "Barn", barn));
      } else {
        cols.className = "card-cols single";
        if (harVoksen) cols.appendChild(lagKolonne("voksen", "Voksen", voksen));
        else cols.appendChild(lagKolonne("barn", "Barn", barn));
      }

      card.appendChild(cols);
      grid.appendChild(card);
    }

    noResults.classList.toggle("hidden", antallTreff > 0);
  }
})();
