
// This is the service worker file.
// It's responsible for handling push notifications when the app is in the background or closed.

// The 'install' event is fired when the service worker is first installed.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  // This tells the browser to activate the new service worker immediately
  // without waiting for the old one to be unregistered.
  self.skipWaiting();
});

// The 'activate' event is fired when the service worker is activated.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  // This takes control of any pages that are already open.
  event.waitUntil(self.clients.claim());
});

// The 'push' event is the core of background notifications.
// It's triggered when the browser receives a push message from a push service.
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received.');
  if (!event.data) {
    console.log('Service Worker: Push event but no data');
    return;
  }

  // Parse the data from the push event. We expect a JSON object.
  const data = event.data.json();
  console.log('Service Worker: Push data:', data);

  // Define the options for the notification that will be shown to the user.
  const options = {
    body: data.body, // The main text of the notification
    icon: '/fav.png', // The icon to display
    badge: '/fav.png', // An icon for the notification tray on some devices
    vibrate: [200, 100, 200], // A vibration pattern
    data: {
      url: data.url || '/', // The URL to open when the notification is clicked
    },
  };

  // Tell the event to wait until the notification is shown.
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// The 'notificationclick' event is fired when a user clicks on a notification.
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked.');
  
  // Close the notification itself.
  event.notification.close();

  // Get the URL from the notification's data payload.
  const urlToOpen = event.notification.data.url;

  // This part focuses or opens a new window/tab to the specified URL.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // If a window for this app is already open, focus it.
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
