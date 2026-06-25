// sw.js - Service Worker для push-уведомлений
const CACHE_NAME = 'localgram-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/settings/settings.css',
    '/settings/settings.js',
    '/manifest.json',
    '/locales/ru.json',
    '/locales/en.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
    let data = {};
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = {
                title: 'Новое сообщение',
                body: event.data.text() || 'У вас новое сообщение',
                icon: '/assets/icons/icon-192.png'
            };
        }
    }
    
    const options = {
        body: data.body || 'Новое сообщение в Localgram',
        icon: data.icon || '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge-icon.png',
        vibrate: [200, 100, 200],
        data: {
            chatId: data.chatId || '',
            partnerId: data.partnerId || '',
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: 'Открыть'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Localgram', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    const chatId = event.notification.data?.chatId || '';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (let client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});