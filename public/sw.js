
// This basic service worker is for Progressive Web App (PWA) functionality.

self.addEventListener('install', (event) => {
  // console.log('Service worker installed');
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  // console.log('Service worker activated');
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

self.addEventListener('fetch', (event) => {
  // We are not caching any requests in this basic service worker.
  // The app will function as online-only.
  // This fetch handler is required for the app to be recognized as a PWA.
  event.respondWith(fetch(event.request));
});


self.addEventListener('push', (event) => {
  if (!event.data) {
    console.error('Push event but no data');
    return;
  }

  const data = event.data.json();
  const title = data.title || 'AlSaqr Logistics';
  const options = {
    body: data.body,
    icon: '/fav.png', // Main app icon
    badge: '/fav.png', // Badge for the notification bar
    data: {
      url: data.url || '/' // URL to open on click
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // If a window for the app is already open, focus it
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        client.focus();
        return client.navigate(urlToOpen);
      }
      // Otherwise, open a new window
      return clients.openWindow(urlToOpen);
    })
  );
});
