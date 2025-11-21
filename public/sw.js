
// Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'AlSaqr Logistics', body: 'لديك تحديث جديد!', url: '/' };
    
    const title = data.title;
    const options = {
      body: data.body,
      icon: '/fav.png', // Main icon
      badge: '/badge.png', // Small monochrome icon for notification bar
      vibrate: [100, 50, 100],
      data: {
        url: data.url,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('Error handling push event:', e);
    // Fallback notification
    const title = 'AlSaqr Logistics';
    const options = {
      body: 'لديك تحديث جديد!',
      icon: '/fav.png',
      badge: '/badge.png',
      data: {
        url: '/',
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});


self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(c => c.navigate(urlToOpen));
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});
