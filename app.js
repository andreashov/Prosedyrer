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
  const netLukk = document.getElementById("net-lukk");
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

  let bannerLukket = false; // brukeren har lukket varselet manuelt

  function probeNett() {
    if (!probeUrl) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch(probeUrl, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: ctrl.signal })
      .then(() => { nettStatus = "tilkoblet"; })
      .catch(() => { nettStatus = "frakoblet"; })
      .finally(() => {
        clearTimeout(timer);
        if (nettStatus === "tilkoblet") bannerLukket = false; // nullstill ved friskmelding
        netBanner.classList.toggle("hidden", nettStatus !== "frakoblet" || bannerLukket);
      });
  }

  netRetry.addEventListener("click", probeNett);
  netLukk.addEventListener("click", () => {
    bannerLukket = true;
    netBanner.classList.add("hidden");
  });

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

  // Nylig åpnede prosedyrer (vises i Spotlight når søkefeltet er tomt)
  let nylige = [];
  try { nylige = JSON.parse(localStorage.getItem("nylige") || "[]"); } catch (e) { nylige = []; }

  function huskNylig(p) {
    nylige = [p.url].concat(nylige.filter((u) => u !== p.url)).slice(0, 6);
    localStorage.setItem("nylige", JSON.stringify(nylige));
  }

  function velgProsedyre(p) {
    if (nettStatus === "frakoblet") {
      // Vis varselet igjen selv om det er lukket – klikket trenger et svar
      bannerLukket = false;
      netBanner.classList.remove("hidden", "pulse");
      void netBanner.offsetWidth;
      netBanner.classList.add("pulse");
      return;
    }
    activeUrl = p.url;
    huskNylig(p);
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
      renderBoard({ x: 0, y: 14, base: 280 }); // åpningen: kortene kaskaderer sist
      return;
    }

    /* Morf (FLIP): kategorier som finnes i begge grupper glir og skalerer
       smidig til sin nye posisjon og størrelse; nye kategorier stiger inn
       fra pillens retning, i takt med bryteren. */
    const gamle = new Map();
    for (const el of board.querySelectorAll(".kolonne")) {
      gamle.set(el.dataset.navn, el.getBoundingClientRect());
    }

    // Ingen felles kategorier (inn/ut av «Annet»): morf ut, så inn
    const nyeNavn = new Set(GRUPPER[g].map((k) => k.navn));
    const harFelles = Array.from(gamle.keys()).some((navn) => nyeNavn.has(navn));
    if (!harFelles) {
      for (const el of board.querySelectorAll(".kolonne")) {
        el.style.transition = "transform 0.18s ease-in, opacity 0.18s ease-in";
        el.style.transform = "translateX(" + -retning * 22 + "px) scale(0.96)";
        el.style.opacity = "0";
      }
      setTimeout(() => renderBoard({ x: retning * 26, y: 0, base: 30 }), 170);
      return;
    }

    renderBoard(null);

    const nye = board.querySelectorAll(".kolonne");
    let nyIndeks = 0;
    for (const el of nye) {
      const forrige = gamle.get(el.dataset.navn);
      if (forrige) {
        const rect = el.getBoundingClientRect();
        const dx = forrige.left - rect.left;
        const dy = forrige.top - rect.top;
        const sx = forrige.width / rect.width;
        const sy = forrige.height / rect.height;
        el.style.transformOrigin = "top left";
        el.style.transition = "none";
        el.style.transform =
          "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
        void el.offsetWidth;
        el.style.transition = "transform 0.5s " + "cubic-bezier(0.32, 0.72, 0, 1)";
        el.style.transform = "";
        el.addEventListener("transitionend", function rydd() {
          el.style.transition = "";
          el.style.transformOrigin = "";
          el.removeEventListener("transitionend", rydd);
        });
      } else {
        el.style.setProperty("--inn-x", retning * 26 + "px");
        el.style.setProperty("--inn-y", "0px");
        el.style.animationDelay = 100 + nyIndeks++ * 50 + "ms";
        el.classList.add("kol-inn");
      }
    }
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

  /* Bento-mosaikk: kuraterte fliser med eksplisitt plassering i et 6×6-nett,
     tilpasset innholdet slik at flisene tesselerer flaten uten hull. Nye
     kategorier (uten oppføring her) faller tilbake til et automatisk spenn. */
  const FLISMONSTER = {
    voksen: {
      "Caput":            { col: "1 / 3", row: "1 / 3" },
      "Underekstremitet": { col: "1 / 3", row: "3 / 7" },
      "Thorax / Abdomen": { col: "3 / 5", row: "1 / 4" },
      "Columna":          { col: "3 / 5", row: "4 / 7" },
      "Overekstremitet":  { col: "5 / 7", row: "1 / 4", spalter: 2 },
      "Bekken":           { col: "5 / 7", row: "4 / 7" }
    },
    barn: {
      "Overekstremitet":     { col: "1 / 3", row: "1 / 4" },
      "Underekstremitet":    { col: "1 / 3", row: "4 / 7" },
      "Thorax / Abdomen":    { col: "3 / 5", row: "1 / 4" },
      "Columna":             { col: "3 / 5", row: "4 / 7" },
      "Spesialundersøkelser":{ col: "5 / 7", row: "1 / 5" },
      "Bekken":              { col: "5 / 7", row: "5 / 7" }
    }
  };

  function flisPlassering(kat) {
    const kuratert = (FLISMONSTER[gruppe] || {})[kat.navn];
    if (kuratert) return kuratert;
    // Fallback for ukjente kategorier: spenn etter mengde, auto-plassert
    const n = kat.prosedyrer.length;
    if (n >= 9) return { span: { c: 2, r: 4 }, spalter: 2 };
    if (n >= 5) return { span: { c: 2, r: 3 } };
    if (n >= 3) return { span: { c: 2, r: 2 } };
    return { span: { c: 2, r: 2 } };
  }

  // Teller antallet mykt opp fra 0 – et lite livstegn ved lasting
  function tellOpp(el, mål, suffiks) {
    const start = performance.now();
    const varighet = 500;
    function steg(nå) {
      const t = Math.min(1, (nå - start) / varighet);
      const verdi = Math.round(mål * (1 - Math.pow(1 - t, 3)));
      el.textContent = verdi + suffiks;
      if (t < 1) requestAnimationFrame(steg);
    }
    requestAnimationFrame(steg);
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
      const n = kat.prosedyrer.length;
      const flis = flisPlassering(kat);
      const kol = document.createElement("section");
      kol.className = "kolonne" + (inngang ? " kol-inn" : "");
      kol.dataset.navn = kat.navn;
      // Bento: eksplisitt plassering i mosaikken (eller auto-spenn som fallback)
      if (flis.col) {
        kol.style.gridColumn = flis.col;
        kol.style.gridRow = flis.row;
      } else {
        kol.style.gridColumn = "span " + flis.span.c;
        kol.style.gridRow = "span " + flis.span.r;
      }
      kol.style.flexGrow = Math.max(1, Math.sqrt(n)).toFixed(2); // for smale skjermer
      if (inngang) kol.style.animationDelay = (inngang.base || 0) + i++ * 45 + "ms";

      const head = document.createElement("div");
      head.className = "kol-head";
      const bilde = BILDER[kat.navn];
      const suffiks = n === 1 ? " prosedyre" : " prosedyrer";
      head.innerHTML =
        '<div class="kol-bilde">' +
        (bilde
          ? '<img src="' + encodeURI(bilde) + '" alt="" loading="lazy">'
          : '<span class="kol-emoji">' + iconFor(kat.navn, kat.admin) + "</span>") +
        "</div>" +
        '<div class="kol-tekst">' +
        '<div class="kol-navn">' + escapeHtml(kat.navn) + "</div>" +
        '<div class="kol-antall">' + n + suffiks + "</div>" +
        "</div>";
      kol.appendChild(head);
      if (inngang) tellOpp(head.querySelector(".kol-antall"), n, suffiks);

      const strek = document.createElement("div");
      strek.className = "kol-strek";
      kol.appendChild(strek);

      const liste = document.createElement("div");
      liste.className = "kol-liste" + (flis.spalter === 2 ? " to-spalter" : "");
      for (const p of kat.prosedyrer) {
        // Ekte lenker: høyreklikk gir nettleserens egen meny («Åpne kobling
        // i nytt vindu» osv.), mens vanlig klikk bruker dokumentvinduet.
        const lenke = document.createElement("a");
        lenke.className = "prosedyre" + (p.url === activeUrl ? " active" : "");
        lenke.href = p.url;
        lenke.target = "_blank";
        lenke.rel = "noopener";
        lenke.textContent = p.navn;
        lenke.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return; // la nettleseren styre
          e.preventDefault();
          velgProsedyre(p);
        });

        // Diskret kopier lenke-knapp, synlig når pekeren er over raden
        const kopier = document.createElement("span");
        kopier.className = "kopier";
        kopier.setAttribute("role", "button");
        kopier.title = "Kopier lenke til dokumentet";
        kopier.innerHTML =
          '<svg class="ik-lenke" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M10 13.5a5 5 0 0 0 7.55.55l2.9-2.9a5 5 0 0 0-7.07-7.07l-1.66 1.65"></path>' +
          '<path d="M14 10.5a5 5 0 0 0-7.55-.55l-2.9 2.9a5 5 0 0 0 7.07 7.07l1.65-1.65"></path></svg>' +
          '<svg class="ik-hake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="4.5 12.5 9.5 17.5 19.5 6.5"></polyline></svg>';
        kopier.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(p.url).then(() => {
            kopier.classList.add("kopiert");
            setTimeout(() => kopier.classList.remove("kopiert"), 1400);
          }).catch(() => {});
        });
        lenke.appendChild(kopier);

        liste.appendChild(lenke);
      }
      kol.appendChild(liste);
      board.appendChild(kol);
    }
  }

  /* ---------- Spotlight-søk ----------
     Flerord: alle ordene i søket må treffe (navn eller kategori).
     Synonymer: dagligtale oversettes til fagtermene i listen.
     Skrivefeil: ett avvik tolereres i ord på 5+ tegn (redigeringsavstand
     mot ordstarter i navnet, så «scapoid» treffer «scaphoideum»). */

  const SYNONYMER = {
    "hode": "caput", "hodet": "caput", "skalle": "caput",
    "lunge": "thorax", "lunger": "thorax", "bryst": "thorax", "hjerte": "cor",
    "mage": "abdomen", "magen": "abdomen", "buk": "abdomen",
    "rygg": "columna", "ryggen": "columna", "ryggsoyle": "columna", "ryggsøyle": "columna",
    "nakke": "cervicalcolumna", "nakken": "cervicalcolumna",
    "korsrygg": "lumbosacralcolumna",
    "hofta": "hofte", "hoften": "hofte",
    "skulderblad": "scapula",
    "krageben": "clavicula", "kragebein": "clavicula",
    "batben": "scaphoideum", "båtben": "scaphoideum", "båtbein": "scaphoideum",
    "hael": "calcaneus", "hæl": "calcaneus", "hælben": "calcaneus",
    "kjeve": "ansikt",
    "ribben": "costa", "ribbein": "costa",
    "brystben": "sternum", "brystbein": "sternum",
    "laar": "femur", "lår": "femur", "lårben": "femur",
    "tommel": "fingre", "finger": "fingre",
    "taa": "tær", "tå": "tær"
  };

  function editAvstand(a, b, maks) {
    if (Math.abs(a.length - b.length) > maks) return maks + 1;
    let forrige = [];
    for (let j = 0; j <= b.length; j++) forrige[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const rad = [i];
      for (let j = 1; j <= b.length; j++) {
        rad[j] = Math.min(
          forrige[j] + 1,
          rad[j - 1] + 1,
          forrige[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      forrige = rad;
    }
    return forrige[b.length];
  }

  // Treffer ordet i søket noe ord i teksten? Returnerer poeng, 0 = ikke treff.
  function ordTreff(token, tekst, ord) {
    const i = tekst.indexOf(token);
    if (i === 0 || (i > 0 && tekst[i - 1] === " ")) return 3; // ordstart
    if (i > 0) return 2; // inne i et ord
    if (token.length >= 5) {
      // tåler én skrivefeil mot starten av hvert ord i teksten
      for (const o of ord) {
        for (const len of [token.length - 1, token.length, token.length + 1]) {
          if (len < 3 || len > o.length) continue;
          if (editAvstand(token, o.slice(0, len), 1) <= 1) return 1;
        }
      }
    }
    return 0;
  }

  function sokeTreff(term) {
    const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const resultat = [];

    for (const p of ALLE) {
      const navnTekst = p.navn.toLowerCase();
      const navnOrd = navnTekst.split(/[^a-zæøå0-9]+/).filter(Boolean);
      const tekst = (p.navn + " " + p.kategori + " " + GRUPPE_NAVN[p.gruppe]).toLowerCase();
      const ord = tekst.split(/[^a-zæøå0-9]+/).filter(Boolean);
      let sum = 0;
      let alle = true;
      for (const token of tokens) {
        const kandidater = [token];
        if (SYNONYMER[token]) kandidater.push(SYNONYMER[token]);
        let poeng = 0;
        for (const k of kandidater) {
          // treff i selve navnet teller dobbelt
          poeng = Math.max(poeng, ordTreff(k, navnTekst, navnOrd) * 2, ordTreff(k, tekst, ord));
        }
        if (poeng === 0) { alle = false; break; }
        sum += poeng;
      }
      if (alle) resultat.push({ p: p, poeng: sum });
    }

    resultat.sort((a, b) => b.poeng - a.poeng || a.p.navn.length - b.p.navn.length);
    return resultat.map((r) => r.p);
  }

  function highlight(navn, term) {
    const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
    const lav = navn.toLowerCase();
    // finn eksakte forekomster av hvert søkeord og slå sammen områdene
    const omrader = [];
    for (const t of tokens) {
      let fra = 0;
      const i = lav.indexOf(t, fra);
      if (i !== -1) omrader.push([i, i + t.length]);
    }
    if (omrader.length === 0) return escapeHtml(navn);
    omrader.sort((a, b) => a[0] - b[0]);
    const flettet = [omrader[0]];
    for (const [s, e] of omrader.slice(1)) {
      const sist = flettet[flettet.length - 1];
      if (s <= sist[1]) sist[1] = Math.max(sist[1], e);
      else flettet.push([s, e]);
    }
    let ut = "";
    let pos = 0;
    for (const [s, e] of flettet) {
      ut += escapeHtml(navn.slice(pos, s)) + "<mark>" + escapeHtml(navn.slice(s, e)) + "</mark>";
      pos = e;
    }
    return ut + escapeHtml(navn.slice(pos));
  }

  let gjeldendeTreff = [];

  function lagResultatRad(p, i, term) {
    const row = document.createElement("a");
    row.className = "result-row" + (i === valgtResultat ? " selected" : "");
    row.href = p.url;
    row.target = "_blank";
    row.rel = "noopener";
    row.setAttribute("role", "option");
    row.innerHTML =
      '<span class="result-navn">' + (term ? highlight(p.navn, term) : escapeHtml(p.navn)) + "</span>" +
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
    return row;
  }

  function apneSpotlight() {
    spotlight.classList.add("open");
    resultsEl.classList.remove("hidden");
    backdrop.classList.remove("hidden");
  }

  // Tomt felt: vis de sist åpnede prosedyrene, som macOS-Spotlight
  function visNylige() {
    const liste = nylige
      .map((url) => ALLE.find((p) => p.url === url))
      .filter(Boolean);
    if (liste.length === 0) {
      lukkSpotlight();
      return;
    }
    gjeldendeTreff = liste;
    valgtResultat = 0;
    resultsEl.innerHTML = "";
    const label = document.createElement("div");
    label.className = "result-label";
    label.textContent = "Nylig åpnet";
    resultsEl.appendChild(label);
    liste.forEach((p, i) => resultsEl.appendChild(lagResultatRad(p, i, "")));
    apneSpotlight();
  }

  function oppdaterSpotlight() {
    const term = searchInput.value.trim();
    if (!term) {
      if (document.activeElement === searchInput) visNylige();
      else lukkSpotlight();
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
      gjeldendeTreff.forEach((p, i) => resultsEl.appendChild(lagResultatRad(p, i, term)));
    }

    apneSpotlight();
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
  searchInput.addEventListener("focus", oppdaterSpotlight);

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

  // Tastatur: 1/2/3 bytter gruppe; å skrive noe annet fanges av søkefeltet
  const SNARVEI_GRUPPE = { "1": "voksen", "2": "barn", "3": "annet" };

  document.addEventListener("keydown", (e) => {
    if (e.target === searchInput) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (SNARVEI_GRUPPE[e.key]) {
      if (SNARVEI_GRUPPE[e.key] !== gruppe) setGruppe(SNARVEI_GRUPPE[e.key]);
      return;
    }
    const skrivbart = e.key.length === 1 && e.key !== " ";
    if (skrivbart || e.key === "/") {
      if (e.key === "/") e.preventDefault();
      searchInput.focus();
    }
  });

  /* ---------- Ambient bevegelse ---------- */

  // Bento-kortene lener seg svakt mot pekeren (parallax)
  let vippet = null;

  board.addEventListener("mousemove", (e) => {
    const kol = e.target.closest(".kolonne");
    if (vippet && vippet !== kol) {
      vippet.style.transform = "";
      vippet = null;
    }
    if (!kol || kol.style.transition) return; // ikke under FLIP-morfen
    const r = kol.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    kol.style.transform =
      "perspective(1100px) rotateX(" + (-py * 1.5).toFixed(2) + "deg) rotateY(" +
      (px * 1.5).toFixed(2) + "deg) translateY(-2px)";
    vippet = kol;
  });

  board.addEventListener("mouseleave", () => {
    if (vippet) {
      vippet.style.transform = "";
      vippet = null;
    }
  });

  // Lysglimtet på glasselementene følger pekeren
  for (const glass of document.querySelectorAll(".spotlight-field, .segmented")) {
    glass.addEventListener("mousemove", (e) => {
      const r = glass.getBoundingClientRect();
      glass.style.setProperty("--mx", (e.clientX - r.left) + "px");
      glass.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  }

  // Plassholderen hvisker frem søkets muligheter når feltet står urørt
  const HINT = [
    "Søk i alle prosedyrer",
    "Prøv «kne barn»",
    "Prøv «scapoid»",
    "Prøv «lunge»",
    "Prøv «ryggen»"
  ];
  let hintIdx = 0;
  const spotlightField = document.querySelector(".spotlight-field");

  setInterval(() => {
    if (document.activeElement === searchInput || searchInput.value) return;
    hintIdx = (hintIdx + 1) % HINT.length;
    spotlightField.classList.add("hint-bytte");
    setTimeout(() => {
      searchInput.placeholder = HINT[hintIdx];
      spotlightField.classList.remove("hint-bytte");
    }, 350);
  }, 4200);

  /* ---------- Installerbar app, med selvoppdatering ----------
     PWA-er viser normalt en ny versjon først ved neste lasting. Her lytter
     vi etter at en ny service worker tar over, og laster da siden på nytt
     én gang automatisk – så du alltid ser siste versjon uten å gjøre noe.
     (Reload skjer bare ved oppdatering, ikke ved aller første besøk.) */
  if ("serviceWorker" in navigator) {
    let laster = false;
    const haddeKontroll = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (haddeKontroll && !laster) {
        laster = true;
        window.location.reload();
      }
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        reg.addEventListener("updatefound", () => {
          const ny = reg.installing;
          if (ny) ny.addEventListener("statechange", () => {
            if (ny.state === "installed" && navigator.serviceWorker.controller) {
              // ny versjon klar – ta over umiddelbart (utløser reload over)
              if (reg.waiting) reg.waiting.postMessage("hopp-koen");
            }
          });
        });
      }).catch(() => { /* uten service worker fungerer siden helt som før */ });

      // Se etter oppdateringer også ved gjenåpning av en installert app
      setInterval(() => navigator.serviceWorker.getRegistration()
        .then((r) => r && r.update()), 60 * 60 * 1000);
    });
  }
})();
