self.addEventListener('push', function(event) {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ника', {
      body: data.body || 'У тебя новое сообщение от Ники',
      icon: '/icons/pwa-192.svg',
      badge: '/icons/pwa-192.svg',
      tag: data.tag || 'nika-notification',
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/chat'));
});
