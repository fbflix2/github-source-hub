// Service Worker for Web Push notifications
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'FBFlix', body: event.data?.text() || '' }; }
  const title = data.title || 'FBFlix';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'fbflix-push',
    renotify: true,
    silent: false,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 300],
    timestamp: Date.now(),
  };
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() =>
      self.registration.showNotification(title, {
        body: data.body || '',
        data: { url: data.url || '/' },
        tag: data.tag || `fbflix-push-${Date.now()}`,
      })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});