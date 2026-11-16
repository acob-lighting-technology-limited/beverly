/* Web Push for Beverly Call. Shows server-sent alerts and opens the right screen on click. */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = typeof data.title === 'string' ? data.title : 'Beverly Call'
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/brand/beverly-mark.png',
    badge: '/brand/beverly-mark.png',
    data: { link: typeof data.link === 'string' && data.link.startsWith('/') ? data.link : '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(link); return } }
    await self.clients.openWindow(link)
  })())
})
