/* Service worker: gjør siden installerbar og raskt tilgjengelig.
   Strategi: nett først (alt er alltid ferskt når man er på nett),
   med hurtiglager som reserve slik at selve siden åpner uten nett. */
const CACHE = "prosedyrer-v7";
const SKALL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "prosedyrer_rontgen.json",
  "logo.png",
  "fonts/inter-latin-wght-normal.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SKALL)));
  self.skipWaiting();
});

// Lar siden be en ventende worker om å ta over med en gang
self.addEventListener("message", (e) => {
  if (e.data === "hopp-koen") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((navn) =>
      Promise.all(navn.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // index.html/navigasjoner hentes ALLTID helt ferskt (aldri fra nettleserens
  // HTTP-cache), så nye filreferanser aldri blir hengende igjen. Øvrige filer
  // er versjonsmerket og trygge å hente normalt (nett først).
  const erSide = e.request.mode === "navigate" ||
    url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  const foresporsel = erSide
    ? new Request(e.request, { cache: "no-store" })
    : e.request;

  e.respondWith(
    fetch(foresporsel)
      .then((svar) => {
        const kopi = svar.clone();
        caches.open(CACHE).then((c) => c.put(e.request, kopi));
        return svar;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
