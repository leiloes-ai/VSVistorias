// GESTORPRO SERVICE WORKER - V1.30.0
// GESTORPRO-SW-SIGNATURE: VALID-V1.30.0-JS
// Data: 09/01/2026 - CORREÇÃO DE MIME REDIRECT

const VERSION = 'v1.30.0';
const CACHE_NAME = `gestorpro-cache-${VERSION}`;

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
  self.registration.showNotification(payload.notification?.title || 'GestorPRO', {
    body: payload.notification?.body || 'Nova atividade detectada.',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/index.html', '/manifest.json', '/icon-192.png']))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('google') || url.hostname.includes('firebase')) return;

  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request).then((networkRes) => {
        if (!networkRes || networkRes.status !== 200) return networkRes;
        const cacheCopy = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        return networkRes;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('/');
        return null;
      });
    })
  );
});