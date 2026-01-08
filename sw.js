// Service Worker Version: v1.17.0
const VERSION = 'v1.17.0';
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

// INSTALL: Cache imediato do App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// ACTIVATE: Limpeza de caches velhos
self.addEventListener('activate', (event) => {
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

// FETCH: Estratégia Stale-While-Revalidate para Shell e Cache-First para imagens
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar chamadas do Firebase e APIs externas
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
      }).catch(() => {
          // Silenciosamente falha se estiver offline e sem cache
      });

      // Retorna o cache imediatamente se houver, ou espera a rede
      return cachedResponse || fetchPromise;
    })
  );
});