// sw.js - Service Worker для push-уведомлений
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
                icon: '/favicon.ico'
            };
        }
    }
    
    const options = {
        body: data.body || 'Новое сообщение в Localgram',
        icon: data.icon || '/favicon.ico',
        badge: '/badge-icon.png',
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

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    const chatId = event.notification.data?.chatId || '';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Проверяем, есть ли уже открытое окно
                for (let client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Если нет - открываем новое
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});