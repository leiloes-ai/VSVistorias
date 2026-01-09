// GESTORPRO SERVICE WORKER - V1.18.4
console.log('[SW] Service Worker v1.18.4 - Inicializando...');

const VERSION = 'v1.18.4';
const CACHE_NAME = `gestorpro-cache-${VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.tsx',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Helper para enviar logs para a aplicação principal
async function logToApp(level, message) {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({ type: 'SW_LOG', level, message: `[Internal SW] ${message}` });
        });
    } catch (e) {}
}

// --- Configuração do Firebase Messaging ---
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
  const notificationTitle = payload.notification?.title || 'GestorPRO';
  const notificationOptions = {
    body: payload.notification?.body || 'Nova atualização no sistema.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100]
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('install', (event) => {
  logToApp('info', `Instalando versão ${VERSION}...`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
});

self.addEventListener('activate', (event) => {
  logToApp('info', `Ativando versão ${VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('gestorpro-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseapp.com') || url.hostname.includes('gstatic.com')) {
    return;
  }

  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});