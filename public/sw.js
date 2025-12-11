
// Listen for the "install" event, which fires when the service worker is installed.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  // Immediately activate the new service worker.
  event.waitUntil(self.skipWaiting());
});

// Listen for the "activate" event, which fires when the service worker is activated.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  // Take control of all pages under its scope immediately.
  event.waitUntil(self.clients.claim());
});

// Listen for the "push" event, which fires when a push message is received.
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received.');
  if (!event.data) {
    console.error('Service Worker: Push event but no data');
    return;
  }

  let notificationData = {
    title: 'رسالة جديدة',
    body: 'لديك تحديث جديد.',
    icon: '/fav.png', // Default icon
    badge: '/badge.png', // Default badge
    data: {
      url: '/', // Default URL if none is provided
    },
  };

  try {
    const data = event.data.json();
    notificationData = {
      ...notificationData,
      title: data.title || notificationData.title,
      body: data.body || notificationData.body,
      data: {
        url: data.url || notificationData.data.url,
      },
    };
  } catch (e) {
    console.error('Service Worker: Error parsing push data', e);
    // If parsing fails, use the raw text as the body
    notificationData.body = event.data.text();
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    dir: 'rtl', // Set text direction to right-to-left for Arabic
    lang: 'ar',   // Set language to Arabic
  };

  // Show the notification.
  event.waitUntil(self.registration.showNotification(notificationData.title, options));
});

// Listen for the "notificationclick" event, which fires when a user clicks on a notification.
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked.');
  
  // Close the notification.
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  // Open the app window or focus it if it's already open.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // Check if there's a window open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
