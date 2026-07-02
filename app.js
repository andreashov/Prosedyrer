/* Røntgenprosedyrer – applikasjonslogikk.
   Data leses fra prosedyrer_rontgen.json. Alt vises på én skjerm:
   glidebryter for Voksen / Barn / Annet, og et Spotlight-søk som søker i
   alle gruppene samtidig. Prosedyrene åpnes i ett felles dokumentvindu i
   full skjermstørrelse som gjenbrukes for hvert valg. */
(function () {
  "use strict";

  const board = document.getElementById("board");
  const searchInput = document.getElementById("search");
  const spotlight = document.getElementById("spotlight");
  const resultsEl = document.getElementById("spotlight-results");
  const backdrop = document.getElementById("backdrop");
  const segments = Array.from(document.querySelectorAll(".segment"));
  const glider = document.getElementById("segment-glider");
  const netBanner = document.getElementById("net-banner");
  const netRetry = document.getElementById("net-retry");
  const themeToggle = document.getElementById("theme-toggle");
  const iconMoon = document.getElementById("icon-moon");
  const iconSun = document.getElementById("icon-sun");

  const GRUPPE_NAVN = { voksen: "Voksen", barn: "Barn", annet: "Annet" };

  // Tilstand
  let gruppe = localStorage.getItem("gruppe") || "voksen";
  if (!GRUPPE_NAVN[gruppe]) gruppe = "voksen";
  let activeUrl = null;
  let valgtResultat = 0;

  // Nettstatus mot sykehusets dokumentserver
  let nettStatus = "ukjent";
  let probeUrl = null;

  // Modell: kategorier per gruppe, og en flat liste for Spotlight-søket
  const GRUPPER = { voksen: [], barn: [], annet: [] };
  const ALLE = []; // { navn, url, kategori, gruppe }

  /* ---------- Tema ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    iconMoon.classList.toggle("hidden", theme === "dark");
    iconSun.classList.toggle("hidden", theme !== "dark");
  }

  applyTheme(
    localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );

  themeToggle.addEventListener("click", () => {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  /* ---------- Bilder og ikoner per kategori ---------- */

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
    if (n.includes("spesial")) return "🔬";
    return "🩻";
  }

  /* ---------- Datainnlasting ---------- */

  function buildModel(data) {
    const perGruppe = { voksen: new Map(), barn: new Map(), annet: new Map() };
    for (const entry of data.rontgen || []) {
      const admin = entry.type === "administrativ";
      const g = admin ? "annet" : entry.pasienttype === "barn" ? "barn" : "voksen";
      let kat = perGruppe[g].get(entry.kategori);
      if (!kat) {
        kat = { navn: entry.kategori, admin: admin, prosedyrer: [] };
        perGruppe[g].set(entry.kategori, kat);
        GRUPPER[g].push(kat);
      }
      for (const p of entry.prosedyrer || []) {
        kat.prosedyrer.push(p);
        ALLE.push({ navn: p.navn, url: p.url, kategori: entry.kategori, gruppe: g });
        if (!probeUrl && p.url.includes("sykehuspartner.no")) probeUrl = p.url;
      }
    }
  }

  fetch("prosedyrer_rontgen.json")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      buildModel(data);
      setGruppe(gruppe, true);
      probeNett();
      setInterval(probeNett, 45000);
    })
    .catch((err) => {
      board.innerHTML =
        '<div class="feilmelding">Kunne ikke laste prosedyrelisten (' +
        escapeHtml(String(err.message || err)) +
        "). Hvis du åpnet siden direkte fra en fil, må den åpnes via en webserver.</div>";
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

  /* Ett navngitt vindu i full skjermstørrelse som gjenbrukes for hver
     prosedyre. Ekte fullskjerm (F11) kan ikke startes utenfra av
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
      netBanner.classList.remove("hidden", "pulse");
      void netBanner.offsetWidth;
      netBanner.classList.add("pulse");
      return;
    }
    activeUrl = p.url;
    apneDokumentvindu(p.url);
    renderBoard();
  }

  /* ---------- Glidebryteren ---------- */

  function setGruppe(g, hopp) {
    gruppe = g;
    localStorage.setItem("gruppe", g);
    const idx = ["voksen", "barn", "annet"].indexOf(g);
    glider.style.transform = "translateX(" + idx * 100 + "%)";
    for (const s of segments) {
      const aktiv = s.dataset.gruppe === g;
      s.classList.toggle("active", aktiv);
      s.setAttribute("aria-selected", String(aktiv));
    }
    if (hopp) {
      renderBoard();
      return;
    }
    // Myk krysstoning ved bytte
    board.classList.add("skifter");
    setTimeout(() => {
      renderBoard();
      board.classList.remove("skifter");
    }, 160);
  }

  for (const s of segments) {
    s.addEventListener("click", () => {
      if (s.dataset.gruppe !== gruppe) setGruppe(s.dataset.gruppe);
    });
  }

  /* ---------- Tavlen ---------- */

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function renderBoard() {
    board.innerHTML = "";
    const kategorier = GRUPPER[gruppe];
    board.classList.toggle("enkel", kategorier.length === 1);

    for (const kat of kategorier) {
      const kol = document.createElement("section");
      kol.className = "kolonne";

      const head = document.createElement("div");
      head.className = "kol-head";
      const bilde = BILDER[kat.navn];
      head.innerHTML =
        '<div class="kol-bilde">' +
        (bilde
          ? '<img src="' + encodeURI(bilde) + '" alt="" loading="lazy">'
          : '<span class="kol-emoji">' + iconFor(kat.navn, kat.admin) + "</span>") +
        "</div>" +
        '<div class="kol-navn">' + escapeHtml(kat.navn) + "</div>" +
        '<div class="kol-antall">' + kat.prosedyrer.length +
        (kat.prosedyrer.length === 1 ? " prosedyre" : " prosedyrer") + "</div>";
      kol.appendChild(head);

      const strek = document.createElement("div");
      strek.className = "kol-strek";
      kol.appendChild(strek);

      const liste = document.createElement("div");
      liste.className = "kol-liste";
      for (const p of kat.prosedyrer) {
        const btn = document.createElement("button");
        btn.className = "prosedyre" + (p.url === activeUrl ? " active" : "");
        btn.textContent = p.navn;
        btn.title = "Åpne i dokumentvinduet";
        btn.addEventListener("click", () => velgProsedyre(p));
        liste.appendChild(btn);
      }
      kol.appendChild(liste);
      board.appendChild(kol);
    }
  }

  /* ---------- Spotlight-søk ---------- */

  function sokeTreff(term) {
    const t = term.toLowerCase();
    const starter = [];
    const inneholder = [];
    for (const p of ALLE) {
      const i = p.navn.toLowerCase().indexOf(t);
      if (i === 0) starter.push(p);
      else if (i > 0) inneholder.push(p);
    }
    return starter.concat(inneholder);
  }

  function highlight(navn, term) {
    const i = navn.toLowerCase().indexOf(term.toLowerCase());
    if (i === -1) return escapeHtml(navn);
    return (
      escapeHtml(navn.slice(0, i)) +
      "<mark>" + escapeHtml(navn.slice(i, i + term.length)) + "</mark>" +
      escapeHtml(navn.slice(i + term.length))
    );
  }

  let gjeldendeTreff = [];

  function oppdaterSpotlight() {
    const term = searchInput.value.trim();
    if (!term) {
      lukkSpotlight();
      return;
    }

    gjeldendeTreff = sokeTreff(term);
    valgtResultat = 0;
    resultsEl.innerHTML = "";

    if (gjeldendeTreff.length === 0) {
      const tom = document.createElement("div");
      tom.className = "result-tom";
      tom.textContent = "Ingen prosedyrer samsvarer med «" + term + "»";
      resultsEl.appendChild(tom);
    } else {
      gjeldendeTreff.forEach((p, i) => {
        const row = document.createElement("button");
        row.className = "result-row" + (i === valgtResultat ? " selected" : "");
        row.setAttribute("role", "option");
        row.innerHTML =
          '<span class="result-navn">' + highlight(p.navn, term) + "</span>" +
          '<span class="result-meta">' +
          '<span class="result-kategori">' + escapeHtml(p.kategori) + "</span>" +
          '<span class="gruppe-badge ' + p.gruppe + '">' + GRUPPE_NAVN[p.gruppe] + "</span>" +
          "</span>";
        row.addEventListener("click", () => {
          velgProsedyre(p);
          lukkSpotlight();
        });
        resultsEl.appendChild(row);
      });
    }

    spotlight.classList.add("open");
    resultsEl.classList.remove("hidden");
    backdrop.classList.remove("hidden");
  }

  function lukkSpotlight() {
    spotlight.classList.remove("open");
    resultsEl.classList.add("hidden");
    backdrop.classList.add("hidden");
    gjeldendeTreff = [];
  }

  function flyttValg(retning) {
    if (gjeldendeTreff.length === 0) return;
    valgtResultat = (valgtResultat + retning + gjeldendeTreff.length) % gjeldendeTreff.length;
    const rader = resultsEl.querySelectorAll(".result-row");
    rader.forEach((r, i) => r.classList.toggle("selected", i === valgtResultat));
    rader[valgtResultat].scrollIntoView({ block: "nearest" });
  }

  searchInput.addEventListener("input", oppdaterSpotlight);

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); flyttValg(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); flyttValg(-1); }
    else if (e.key === "Enter") {
      if (gjeldendeTreff.length > 0) {
        velgProsedyre(gjeldendeTreff[valgtResultat]);
        lukkSpotlight();
      }
    } else if (e.key === "Escape") {
      searchInput.value = "";
      lukkSpotlight();
      searchInput.blur();
    }
  });

  backdrop.addEventListener("click", () => {
    searchInput.value = "";
    lukkSpotlight();
  });

  // Begynn å skrive hvor som helst – søkefeltet fanger det, som Spotlight
  document.addEventListener("keydown", (e) => {
    if (e.target === searchInput) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const skrivbart = e.key.length === 1 && e.key !== " ";
    if (skrivbart || e.key === "/") {
      if (e.key === "/") e.preventDefault();
      searchInput.focus();
    }
  });
})();
