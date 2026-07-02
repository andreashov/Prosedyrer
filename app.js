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
  const vinduToggle = document.getElementById("vindu-toggle");
  const iconNytt = document.getElementById("icon-nytt");
  const iconFull = document.getElementById("icon-full");
  const iconHalv = document.getElementById("icon-halv");

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

  /* Tre måter å åpne dokumentene på ved vanlig klikk:
     - "full":  ett gjenbrukt popup-vindu i hele den tilgjengelige skjermen
                (nærmest fullskjerm et skript har lov til å komme).
     - "hoyre": ett gjenbrukt popup-vindu i høyre halvdel, full høyde.
     - "fane":  vanlig ny fane, styrt av nettleseren.
     Merk: nettlesere tillater ikke at skript åpner et vanlig nytt
     nettleservindu med faner – det valget er forbeholdt brukeren selv.
     Shift+klikk og høyreklikk → «Åpne kobling i nytt vindu» gjør det,
     og fungerer på alle prosedyrene siden de er ekte lenker. */
  const VINDU_MODI = ["fane", "full", "hoyre"];
  let vinduModus = localStorage.getItem("vinduModus4") || "fane";
  if (VINDU_MODI.indexOf(vinduModus) === -1) vinduModus = "fane";
  let dokVindu = null;

  function vinduGeometri() {
    const x0 = screen.availLeft || 0;
    const y0 = screen.availTop || 0;
    if (vinduModus === "hoyre") {
      const w = Math.max(620, Math.round(screen.availWidth / 2));
      return { w: w, h: screen.availHeight, x: x0 + screen.availWidth - w, y: y0 };
    }
    return { w: screen.availWidth, h: screen.availHeight, x: x0, y: y0 };
  }

  function apneDokumentvindu(url) {
    if (vinduModus === "fane") {
      window.open(url, "_blank", "noopener");
      return;
    }
    const g = vinduGeometri();
    const vindu = window.open(
      url,
      "prosedyreVindu",
      "popup=yes,width=" + g.w + ",height=" + g.h + ",left=" + g.x + ",top=" + g.y
    );
    if (!vindu) {
      window.open(url, "_blank"); // popup blokkert – fall tilbake til fane
      return;
    }
    dokVindu = vindu;
    vindu.focus();
  }

  const VINDU_TITLER = {
    fane: "Dokumenter åpnes i ny fane – klikk for gjenbrukt vindu i hele skjermen. " +
      "Tips: Shift+klikk på en prosedyre gir ekte nytt nettleservindu.",
    full: "Dokumenter åpnes i ett gjenbrukt vindu i hele skjermen – klikk for høyre halvdel. " +
      "Tips: Shift+klikk på en prosedyre gir ekte nytt nettleservindu.",
    hoyre: "Dokumenter åpnes i ett gjenbrukt vindu i høyre halvdel – klikk for ny fane. " +
      "Tips: Shift+klikk på en prosedyre gir ekte nytt nettleservindu."
  };

  function oppdaterVinduToggle() {
    iconFull.classList.toggle("hidden", vinduModus !== "full");
    iconHalv.classList.toggle("hidden", vinduModus !== "hoyre");
    iconNytt.classList.toggle("hidden", vinduModus !== "fane");
    vinduToggle.title = VINDU_TITLER[vinduModus];
  }

  vinduToggle.addEventListener("click", () => {
    vinduModus = VINDU_MODI[(VINDU_MODI.indexOf(vinduModus) + 1) % VINDU_MODI.length];
    localStorage.setItem("vinduModus4", vinduModus);
    oppdaterVinduToggle();
    // Er popup-vinduet åpent, endres størrelsen med en gang
    if (vinduModus !== "fane" && dokVindu && !dokVindu.closed) {
      const g = vinduGeometri();
      try {
        dokVindu.resizeTo(g.w, g.h);
        dokVindu.moveTo(g.x, g.y);
      } catch (e) { /* nekter nettleseren, gjelder ny størrelse fra neste åpning */ }
    }
  });

  oppdaterVinduToggle();

  function velgProsedyre(p) {
    if (nettStatus === "frakoblet") {
      netBanner.classList.remove("hidden", "pulse");
      void netBanner.offsetWidth;
      netBanner.classList.add("pulse");
      return;
    }
    activeUrl = p.url;
    apneDokumentvindu(p.url);
    oppdaterAktiv(); // marker uten å tegne tavlen på nytt (unngår animasjonsreprise)
  }

  function oppdaterAktiv() {
    for (const a of board.querySelectorAll(".prosedyre")) {
      a.classList.toggle("active", a.href === activeUrl);
    }
  }

  /* ---------- Glidebryteren ---------- */

  const GRUPPE_REKKEFOLGE = ["voksen", "barn", "annet"];

  function setGruppe(g, hopp) {
    const forrigeIdx = GRUPPE_REKKEFOLGE.indexOf(gruppe);
    const nyIdx = GRUPPE_REKKEFOLGE.indexOf(g);
    const retning = nyIdx >= forrigeIdx ? 1 : -1;
    gruppe = g;
    localStorage.setItem("gruppe", g);
    glider.style.transform = "translateX(" + nyIdx * 100 + "%)";
    for (const s of segments) {
      const aktiv = s.dataset.gruppe === g;
      s.classList.toggle("active", aktiv);
      s.setAttribute("aria-selected", String(aktiv));
    }
    if (hopp) {
      renderBoard({ x: 0, y: 14 }); // første visning: kolonnene stiger inn
      return;
    }
    // Retningsbevisst bytte: innholdet glir ut den ene veien og kaskaderer
    // inn fra motsatt side, i takt med pillen i skyvebryteren.
    board.classList.add("ut");
    board.style.setProperty("--ut-x", -retning * 16 + "px");
    setTimeout(() => {
      board.classList.remove("ut");
      renderBoard({ x: retning * 26, y: 0 });
    }, 150);
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

  function renderBoard(inngang) {
    board.innerHTML = "";
    const kategorier = GRUPPER[gruppe];
    board.classList.toggle("enkel", kategorier.length === 1);
    if (inngang) {
      board.style.setProperty("--inn-x", inngang.x + "px");
      board.style.setProperty("--inn-y", inngang.y + "px");
    }

    let i = 0;
    for (const kat of kategorier) {
      const kol = document.createElement("section");
      kol.className = "kolonne" + (inngang ? " kol-inn" : "");
      if (inngang) kol.style.animationDelay = i++ * 45 + "ms";

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
        // Ekte lenker: høyreklikk gir nettleserens egen meny («Åpne kobling
        // i nytt vindu» osv.), mens vanlig klikk bruker dokumentvinduet.
        const lenke = document.createElement("a");
        lenke.className = "prosedyre" + (p.url === activeUrl ? " active" : "");
        lenke.href = p.url;
        lenke.target = "_blank";
        lenke.rel = "noopener";
        lenke.textContent = p.navn;
        lenke.title = "Åpne i dokumentvinduet";
        lenke.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return; // la nettleseren styre
          e.preventDefault();
          velgProsedyre(p);
        });
        liste.appendChild(lenke);
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
        const row = document.createElement("a");
        row.className = "result-row" + (i === valgtResultat ? " selected" : "");
        row.href = p.url;
        row.target = "_blank";
        row.rel = "noopener";
        row.setAttribute("role", "option");
        row.innerHTML =
          '<span class="result-navn">' + highlight(p.navn, term) + "</span>" +
          '<span class="result-meta">' +
          '<span class="result-kategori">' + escapeHtml(p.kategori) + "</span>" +
          '<span class="gruppe-badge ' + p.gruppe + '">' + GRUPPE_NAVN[p.gruppe] + "</span>" +
          "</span>";
        row.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return; // la nettleseren styre
          e.preventDefault();
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
