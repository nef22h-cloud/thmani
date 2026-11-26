/// <reference lib="webworker" />
// Service Worker مخصص: تخزين مؤقت للعمل بدون إنترنت + الإشعارات

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';
import { runReminders } from './services/reminderRunner.js';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// كل روابط التطبيق ترجع index.html (عشان يشتغل بدون نت على أي صفحة)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// الخطوط من Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' })
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({ cacheName: 'google-fonts-files' })
);

// ملفات قارئ النص (Tesseract) من jsDelivr: نحفظها عشان OCR يشتغل بدون نت بعد أول مرة
registerRoute(
  ({ url }) => url.origin === 'https://cdn.jsdelivr.net' && /tesseract/.test(url.pathname),
  new CacheFirst({ cacheName: 'ocr-engine' })
);

const show = (title, options) => self.registration.showNotification(title, options);

// فحص دوري في الخلفية (Chrome/Edge على أندرويد للتطبيقات المثبتة)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'damani-reminders') {
    event.waitUntil(runReminders(show));
  }
});

// جاهز لـ Web Push من سيرفر لاحقاً (المرحلة القادمة مع المزامنة السحابية)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: 'ضماني', body: event.data?.text() };
  }
  event.waitUntil(
    payload.title
      ? show(payload.title, { body: payload.body, dir: 'rtl', lang: 'ar', icon: '/icons/icon-192.png', data: payload.data })
      : runReminders(show) // push "صامت" = افحص التنبيهات محلياً
  );
});

// الضغط على الإشعار يفتح صفحة الضمان
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          c.navigate?.(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_REMINDERS') {
    event.waitUntil(runReminders(show));
  }
});
