// Service Worker Version: Incrementar esta versão acionará o evento 'install'
// e atualizará o cache, garantindo que os usuários recebam a versão mais recente do aplicativo.
const VERSION = 'v1.10.0';

// Cache Name: Um nome exclusivo para o armazenamento de cache do aplicativo. Usar a versão
// garante que novos service workers usem um novo cache, evitando conflitos.
const CACHE_NAME = `gestorpro-cache-${VERSION}`;

// App Shell: Uma lista de arquivos essenciais para a funcionalidade básica do aplicativo.
// O cache desses arquivos permite que o aplicativo carregue instantaneamente e funcione offline.
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.tsx',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^18.2.0',
  'https://esm.sh/react-dom@^18.2.0',
  'https://esm.sh/recharts@2.12.7',
  'https://esm.sh/xlsx@0.18.5',
  'https://esm.sh/jspdf@2.5.1',
  'https://esm.sh/jspdf-autotable@3.8.2'
];

// --- Configuração do Firebase Cloud Messaging (FCM) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-sw.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwhB3e0cQiIYIcjQRqN2hCFviv5iVPNO4",
  authDomain: "appvsvistorias1.firebaseapp.com",
  projectId: "appvsvistorias1",
  storageBucket: "appvsvistorias1.firebasestorage.app",
  messagingSenderId: "987443685390",
  appId: "1:987443685390:web:2a222636b79429ef42f45f"
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, (payload) => {
  console.log('[Service Worker] Recebeu notificação push em segundo plano:', payload);
  const notificationTitle = payload.notification?.title || 'GestorPRO';
  const notificationOptions = {
    body: payload.notification?.body || 'Você tem uma nova notificação.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200]
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Evento INSTALL
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Evento ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('gestorpro-cache-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
    ])
  );
});

// Listener de Mensagem
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estratégia Stale-While-Revalidate
async function staleWhileRevalidate(event) {
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return fetch(event.request);
    }
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {});
    return cachedResponse || fetchPromise;
}

// Evento FETCH
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isFirebaseRequest = request.url.includes('firestore.googleapis.com') || request.url.includes('firebaseinstallations.googleapis.com');
  if (request.method !== 'GET' || isFirebaseRequest) {
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});

// Evento NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});