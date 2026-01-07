// Service Worker Version: Incrementar esta versão acionará o evento 'install'
// e atualizará o cache, garantindo que os usuários recebam a versão mais recente do aplicativo.
const VERSION = 'v1.9.0';

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
// Essas importações são necessárias para lidar com notificações push em segundo plano.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-sw.js";

// A configuração do Firebase do seu aplicativo da web deve estar presente no service worker.
const firebaseConfig = {
  apiKey: "AIzaSyDwhB3e0cQiIYIcjQRqN2hCFviv5iVPNO4",
  authDomain: "appvsvistorias1.firebaseapp.com",
  projectId: "appvsvistorias1",
  storageBucket: "appvsvistorias1.firebasestorage.app",
  messagingSenderId: "987443685390",
  appId: "1:987443685390:web:2a222636b79429ef42f45f"
};

// Inicializa o Firebase no contexto do service worker.
const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

/**
 * Lida com notificações push recebidas quando o aplicativo está em segundo plano ou fechado.
 * Esta função é acionada pelo SDK do Firebase.
 */
onBackgroundMessage(messaging, (payload) => {
  console.log('[Service Worker] Recebeu notificação push em segundo plano:', payload);

  const notificationTitle = payload.notification?.title || 'GestorPRO';
  const notificationOptions = {
    body: payload.notification?.body || 'Você tem uma nova notificação.',
    icon: '/icon-192.png', // Ícone exibido na notificação
    badge: '/icon-192.png', // Ícone para o ponto de notificação na tela inicial do Android
    vibrate: [200, 100, 200] // Padrão de vibração em dispositivos móveis
  };

  // O service worker exibe a notificação para o usuário.
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- Listeners de Eventos do Ciclo de Vida do PWA ---

/**
 * Evento INSTALL: Disparado quando o service worker é instalado.
 * Armazena o App Shell em cache. O novo SW aguardará para ser ativado.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Evento: install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Armazenando App Shell em cache...');
      // addAll é atômico. Se um arquivo falhar, todo o cache falha.
      return cache.addAll(APP_SHELL_URLS).catch(error => {
          console.error('[Service Worker] Falha ao armazenar App Shell em cache:', error);
      });
    })
  );
});

/**
 * Evento ACTIVATE: Disparado quando o novo service worker é ativado.
 * Limpa caches antigos e assume o controle das páginas abertas.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Evento: activate');
  event.waitUntil(
    Promise.all([
      // Permite que o SW ativado assuma o controle de todas as abas abertas imediatamente.
      self.clients.claim(),
      // Limpa caches antigos que não correspondem à versão atual.
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('gestorpro-cache-') && cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[Service Worker] Excluindo cache antigo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
    ])
  );
});

/**
 * Listener de Mensagem: Usado para acionar o skipWaiting() a partir da aplicação principal.
 * Isso permite que o usuário decida quando aplicar uma atualização pendente.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Recebeu mensagem SKIP_WAITING. Ativando novo SW.');
    self.skipWaiting();
  }
});


/**
 * Estratégia Stale-While-Revalidate.
 * Responde imediatamente com o cache (se disponível), enquanto busca uma
 * versão atualizada na rede em segundo plano para atualizar o cache.
 * Isso proporciona uma experiência de usuário muito rápida e garante que
 * o conteúdo seja atualizado para a próxima visita.
 */
async function staleWhileRevalidate(event) {
    // Não intercepta requisições que não são GET ou são para extensões do Chrome.
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return fetch(event.request);
    }
    
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);

    // Inicia a busca na rede em paralelo.
    const fetchPromise = fetch(event.request).then(networkResponse => {
        // Se a busca for bem-sucedida, atualiza o cache.
        if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(err => {
        // A busca na rede falhou, o que é esperado offline.
        // Se já tínhamos uma resposta em cache, o usuário não perceberá.
        console.warn(`[Service Worker] Busca na rede falhou para ${event.request.url}:`, err);
        // Se a busca falhar e não houver cache, um erro de rede será propagado.
        // O `cachedResponse` será usado se existir.
    });

    // Retorna a resposta do cache imediatamente se existir, caso contrário, aguarda a rede.
    return cachedResponse || fetchPromise;
}

/**
 * Evento FETCH: Intercepta todas as requisições de rede.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora solicitações que não são GET (ex: POST) e as do Firebase, que têm sua própria gestão offline.
  const isFirebaseRequest = request.url.includes('firestore.googleapis.com') || request.url.includes('firebaseinstallations.googleapis.com');
  if (request.method !== 'GET' || isFirebaseRequest) {
    return;
  }
  
  // Aplica a estratégia Stale-While-Revalidate para todas as outras solicitações.
  event.respondWith(staleWhileRevalidate(event));
});


/**
 * Evento NOTIFICATION CLICK: Disparado quando um usuário clica em uma notificação push.
 * Isso traz o usuário de volta para a aplicação.
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Evento: notificationclick');

  // Fecha o pop-up da notificação.
  event.notification.close();

  // Foca em uma janela existente do aplicativo ou abre uma nova.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se uma janela do aplicativo já estiver aberta, foca nela.
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Caso contrário, abre uma nova janela para a URL raiz do aplicativo.
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});