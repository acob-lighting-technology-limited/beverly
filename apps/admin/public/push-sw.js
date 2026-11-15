self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = { body: event.data?.text() ?? '' }; }

  const origin = self.location.origin;
  const iconUrl = payload.icon ? new URL(payload.icon, origin).href : new URL('./pwa-192.png', origin).href;
  const badgeUrl = payload.badge ? new URL(payload.badge, origin).href : iconUrl;
  const targetUrl = payload.url || payload.data?.url || 'notifications';

  const title = payload.title || 'Beverly';
  const options = {
    body: payload.body || 'You have a new update.',
    icon: iconUrl,
    badge: badgeUrl,
    image: payload.image ? new URL(payload.image, origin).href : undefined,
    tag: payload.tag || ('beverly-alert-' + Date.now()),
    renotify: true,
    requireInteraction: payload.requireInteraction !== false,
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [200, 100, 200, 100, 200],
    silent: payload.silent === true,
    timestamp: payload.timestamp || Date.now(),
    actions: payload.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: {
      url: targetUrl,
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil((async () => {
    const path = String(event.notification.data?.url || 'notifications').replace(/^\/+/, '');
    const target = new URL(path, self.registration.scope);
    if (target.origin !== self.location.origin || !target.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (!new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname)) continue;
      if ('navigate' in client) await client.navigate(target.href);
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
