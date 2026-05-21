// Push event — show native OS notification
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cheese Pay', {
      body:     data.body  || '',
      icon:     '/icons/icon-192.png',
      badge:    '/icons/icon-96.png',
      tag:      data.tag   || 'cheese-notification',
      renotify: true,
      data:     { url: data.url || '/notifications' },
    })
  )
})

// Notification click — focus existing window or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/notifications'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
