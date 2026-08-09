// Stash – Service Worker
// Cacht die App-Hülle, damit sie auch ohne Netz startet.
// Firebase-Verbindungen laufen nicht über diesen Cache.

const CACHE_VERSION = "vorrat-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./fonts/fraunces-500.woff2",
  "./fonts/fraunces-600.woff2",
  "./fonts/fraunces-700.woff2",
  "./fonts/inter-400.woff2",
  "./fonts/inter-500.woff2",
  "./fonts/inter-600.woff2",
  "./fonts/inter-700.woff2",
  "./fonts/jetbrains-mono-500.woff2",
  "./fonts/jetbrains-mono-700.woff2"
];

// Diese Dateien ändern sich, wenn die App aktualisiert wird. Für sie fragen
// wir zuerst das Netz (damit Updates ankommen), und nutzen den Cache nur als
// Fallback ohne Netz. Alles andere (Icons, Fonts, ...) bleibt cache-first,
// weil es sich praktisch nie ändert und cache-first schneller ist.
const NETWORK_FIRST_FILES = ["/index.html", "/app.js", "/style.css", "/manifest.json"];

self.addEventListener("install", (event) => {
  // Bewusst kein caches.addAll(): das würde die komplette Installation
  // abbrechen, sobald eine einzige Datei fehlt (z. B. eine Font-Datei, die
  // noch nicht hochgeladen wurde) - und dann wäre die App gar nicht mehr
  // offline-fähig. Stattdessen jede Datei einzeln versuchen; eine fehlende
  // Datei fällt dann einfach auf den normalen Netzwerk-Request zurück.
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn("SW: konnte nicht cachen:", url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nie Firebase/Firestore-Traffic aus dem Cache bedienen - immer live.
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return; // Browser macht normalen Netzwerk-Request
  }

  const isAppShellFile =
    req.mode === "navigate" ||
    NETWORK_FIRST_FILES.some((p) => url.pathname === p || url.pathname.endsWith(p));

  if (isAppShellFile) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (req.method === "GET" && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
