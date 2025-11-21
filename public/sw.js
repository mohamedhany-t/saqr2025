
// Listen for push events
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'رسالة جديدة';
  const options = {
    body: data.body || 'لديك تحديث جديد.',
    icon: '/fav.png', // Main app icon
    badge: '/fav.png', // A smaller icon for the notification bar
    data: {
      url: data.url || '/'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for notification click events
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  // This looks for an existing window and focuses it.
  // If no window is found, it opens a new one.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function (clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
