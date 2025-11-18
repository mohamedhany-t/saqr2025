
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/fav.png',
    badge: '/fav.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // This can be customized to open a specific URL
  event.waitUntil(
    clients.openWindow('/')
  );
});
