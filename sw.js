/* Service worker — Bora pra Faxina!
   Ao publicar uma nova versão do index.html, aumente o número de CACHE. */
const CACHE = 'bora-pra-faxina-v1';
const ASSETS = ['./', './index.html', './manifest.json', './instalar.html', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes e SDK do Firebase: guarda em cache para abrir offline
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host) || url.href.startsWith('https://www.gstatic.com/firebasejs/')) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // Login e banco de dados do Firebase: sempre pela rede (o próprio Firestore cuida do offline)
  if (url.origin !== location.origin) return;

  // Página: rede primeiro, cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Demais arquivos do app: cache primeiro
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })));
});
