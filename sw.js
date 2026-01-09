// GESTORPRO SERVICE WORKER - V1.23.0
// Data: 09/01/2026 - CORREÇÃO DE DISTRIBUIÇÃO
console.log('%c[SW] v1.23.0 - Iniciando ciclo de vida operacional...', 'color: #2563eb; font-weight: bold;');

const VERSION = 'v1.23.0';
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
    badge: '/icon-192.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Cacheando Shell v1.23.0...');
        return cache.addAll(APP_SHELL_URLS).catch(err => console.warn('[SW] Shell parcial:', err));
    })
  );
});

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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('gstatic.com') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('vercel')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('/');
      });
    })
  );
});