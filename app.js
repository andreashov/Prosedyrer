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

  /* Kaskader kortene inn: de stiger og glir inn fra en retning, ett etter ett.
     «start» gir en litt roligere inngang første gang siden vises. */
  function animerInn(retning, start) {
    let i = 0;
    for (const el of board.querySelectorAll(".kolonne")) {
      el.style.setProperty("--inn-x", (start ? 0 : retning * 22) + "px");
      el.style.setProperty("--inn-y", (start ? 14 : 10) + "px");
      el.style.animationDelay = (start ? 120 : 30) + i++ * (start ? 55 : 42) + "ms";
      el.classList.add("kol-inn");
    }
  }

  function setGruppe(g, forstegang) {
    const retning =
      GRUPPE_REKKEFOLGE.indexOf(g) >= GRUPPE_REKKEFOLGE.indexOf(gruppe) ? 1 : -1;
    gruppe = g;
    lukkKort(true); // lukk et eventuelt åpent forgrunnskort momentant
    localStorage.setItem("gruppe", g);
    glider.style.transform = "translateX(" + GRUPPE_REKKEFOLGE.indexOf(g) * 100 + "%)";
    for (const s of segments) {
      const aktiv = s.dataset.gruppe === g;
      s.classList.toggle("active", aktiv);
      s.setAttribute("aria-selected", String(aktiv));
    }
    if (forstegang) {
      renderBoard();
      animerInn(retning, true);
      return;
    }

    /* Stilig gruppebytte: de gjeldende kortene glir ut sideveis og toner bort
       i motsatt retning av bevegelsen, deretter kaskaderer de nye kortene inn
       fra samme kant. Ingen morf av selve rutenettet – en ren, retningsbestemt
       overgang som følger den glidende bryteren. */
    const gamle = Array.from(board.querySelectorAll(".kolonne"));
    if (!gamle.length) {
      renderBoard();
      animerInn(retning, false);
      return;
    }
    let i = 0;
    for (const el of gamle) {
      el.style.setProperty("--ut-x", -retning * 20 + "px");
      el.style.animationDelay = i++ * 18 + "ms";
      el.classList.remove("kol-inn");
      el.classList.add("kol-ut");
    }
    const ventetid = 150 + gamle.length * 18;
    setTimeout(() => {
      renderBoard();
      animerInn(retning, false);
    }, ventetid);
  }

  for (const s of segments) {
    s.addEventListener("click", () => {
      if (s.dataset.gruppe !== gruppe) setGruppe(s.dataset.gruppe);
    });
  }

  /* ---------- Forgrunnskort (hero-overgang med frostet bakteppe) ----------
     Klikk et gallerikort: det flyr fra sin plass opp i forgrunnen i lesbar
     størrelse (FLIP), mens bakgrunnen legges bak et uklart bakteppe. Klikk
     bakteppet, ×, eller Esc for å sende det tilbake på plass. */
  const kortlag = document.createElement("div");
  kortlag.className = "kortlag hidden";
  kortlag.innerHTML = '<div class="kortlag-bakteppe"></div>';
  document.body.appendChild(kortlag);
  const kortBakteppe = kortlag.querySelector(".kortlag-bakteppe");
  let panel = null;       // forgrunnskortet
  let panelKilde = null;  // gallerikortet det kom fra

  const HERO_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // myk «ease-out», Apple-aktig
  const LUKK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';

  function byggPanel(kat) {
    const n = kat.prosedyrer.length;
    const el = document.createElement("section");
    el.className = "kolonne panel";
    el.dataset.navn = kat.navn;
    const bilde = BILDER[kat.navn];
    const suffiks = n === 1 ? " prosedyre" : " prosedyrer";

    const head = document.createElement("div");
    head.className = "kol-head";
    head.innerHTML =
      '<div class="kol-bilde">' +
      (bilde
        ? '<img src="' + encodeURI(bilde) + '" alt="">'
        : '<span class="kol-emoji">' + iconFor(kat.navn, kat.admin) + "</span>") +
      "</div>" +
      '<div class="kol-tekst"><div class="kol-navn">' + escapeHtml(kat.navn) +
      '</div><div class="kol-antall">' + n + suffiks + "</div></div>" +
      '<button type="button" class="kol-lukk" title="Lukk" aria-label="Lukk">' + LUKK_SVG + "</button>";
    head.querySelector(".kol-lukk").addEventListener("click", () => lukkKort());
    el.appendChild(head);

    const strek = document.createElement("div");
    strek.className = "kol-strek";
    el.appendChild(strek);

    const liste = document.createElement("div");
    liste.className = "kol-liste" + (n >= 8 ? " to-spalter" : "");
    for (const p of kat.prosedyrer) liste.appendChild(lagProsedyreLenke(p));
    el.appendChild(liste);
    return el;
  }

  /* Måler forskyvningen fra ett korts senter til et annet – brukes til å heve
     panelet opp fra det klikkede gallerikortet (og sende det tilbake). */
  function senterDelta(fra, til) {
    return {
      dx: (fra.left + fra.width / 2) - (til.left + til.width / 2),
      dy: (fra.top + fra.height / 2) - (til.top + til.height / 2)
    };
  }

  function openKort(kat, kilde) {
    if (panel) return;
    kilde.style.transform = ""; // nullstill en evt. parallax-vipp før måling
    panelKilde = kilde;
    panel = byggPanel(kat);
    kortlag.appendChild(panel);
    kortlag.classList.remove("hidden");

    /* Panelet står ferdig bygd i endelig størrelse (skarp tekst hele veien).
       Vi hever det opp fra det klikkede kortets plass med en JEVN skala
       (lik i begge retninger = ingen tekststrekk) mens det toner inn –
       bevegelse og innhold synkront, uten etterslep. */
    const { dx, dy } = senterDelta(kilde.getBoundingClientRect(), panel.getBoundingClientRect());
    panel.style.transformOrigin = "center center";
    panel.style.transform = "translate(" + dx + "px," + dy + "px) scale(0.92)";
    panel.style.opacity = "0";
    kilde.style.visibility = "hidden";
    void panel.offsetWidth;
    requestAnimationFrame(() => {
      kortlag.classList.add("apen");
      panel.style.transition = "transform 0.44s " + HERO_EASE + ", opacity 0.34s ease-out";
      panel.style.transform = "";
      panel.style.opacity = "1";
      panel.addEventListener("transitionend", function ferdig(e) {
        if (e.propertyName !== "transform") return;
        panel.style.transition = "";
        panel.style.transform = "";
        panel.style.transformOrigin = "";
        panel.removeEventListener("transitionend", ferdig);
      });
    });
  }

  function lukkKort(momentant) {
    if (!panel) return;
    const p = panel, kilde = panelKilde;
    panel = null;
    panelKilde = null;

    if (momentant || !kilde || !document.body.contains(kilde)) {
      kortlag.classList.add("hidden");
      kortlag.classList.remove("apen");
      p.remove();
      if (kilde) kilde.style.visibility = "";
      return;
    }

    // Speil hevingen: panelet glir tilbake mot gallerikortets plass, skalerer
    // jevnt ned og toner ut – synkront, uten tekststrekk.
    const { dx, dy } = senterDelta(kilde.getBoundingClientRect(), p.getBoundingClientRect());
    kortlag.classList.remove("apen");
    p.style.transformOrigin = "center center";
    p.style.transition = "transform 0.4s " + HERO_EASE + ", opacity 0.3s ease-in";
    requestAnimationFrame(() => {
      p.style.opacity = "0";
      p.style.transform = "translate(" + dx + "px," + dy + "px) scale(0.92)";
    });
    p.addEventListener("transitionend", function ferdig(e) {
      if (e.propertyName !== "transform") return;
      kortlag.classList.add("hidden");
      p.remove();
      kilde.style.visibility = "";
      p.removeEventListener("transitionend", ferdig);
    });
  }

  kortBakteppe.addEventListener("click", () => lukkKort());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel) { e.preventDefault(); lukkKort(); }
  });

  /* ---------- Tavlen ---------- */

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  // Bygger én prosedyrelenke med diskret kopier-knapp
  function lagProsedyreLenke(p) {
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
    return lenke;
  }

  function korthode(kat, n) {
    const bilde = BILDER[kat.navn];
    const suffiks = n === 1 ? " prosedyre" : " prosedyrer";
    return (
      '<div class="kol-head">' +
      '<div class="kol-bilde">' +
      (bilde
        ? '<img src="' + encodeURI(bilde) + '" alt="" loading="lazy">'
        : '<span class="kol-emoji">' + iconFor(kat.navn, kat.admin) + "</span>") +
      "</div>" +
      '<div class="kol-tekst">' +
      '<div class="kol-navn">' + escapeHtml(kat.navn) + "</div>" +
      '<div class="kol-antall">' + n + suffiks + "</div>" +
      "</div></div>"
    );
  }

  /* Galleri: rolige kort med bilde + navn + antall. Klikk et kort og det flyr
     opp i forgrunnen (openKort). Er det bare én kategori («Annet»), vises alle
     lenkene direkte i ett rolig kort. */
  function renderBoard() {
    const kategorier = GRUPPER[gruppe];
    const enkelt = kategorier.length === 1;
    board.classList.toggle("enkel", enkelt);
    board.innerHTML = "";

    for (const kat of kategorier) {
      const n = kat.prosedyrer.length;

      if (enkelt) {
        const kort = document.createElement("section");
        kort.className = "kolonne apent-inline";
        kort.dataset.navn = kat.navn;
        kort.innerHTML = korthode(kat, n);
        const strek = document.createElement("div");
        strek.className = "kol-strek";
        kort.appendChild(strek);
        const liste = document.createElement("div");
        liste.className = "kol-liste" + (n >= 8 ? " to-spalter" : "");
        for (const p of kat.prosedyrer) liste.appendChild(lagProsedyreLenke(p));
        kort.appendChild(liste);
        board.appendChild(kort);
        continue;
      }

      const kort = document.createElement("button");
      kort.type = "button";
      kort.className = "kolonne";
      kort.dataset.navn = kat.navn;
      kort.innerHTML = korthode(kat, n);
      kort.addEventListener("click", () => openKort(kat, kort));
      board.appendChild(kort);
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
    if (panel) return; // et forgrunnskort er åpent – la Esc/lukk styre
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
    // ikke under morf, og ikke på det store aktive kortet
    if (!kol || kol.style.transition || kol.classList.contains("aktiv")) return;
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
