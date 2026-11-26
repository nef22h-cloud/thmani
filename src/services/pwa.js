// تسجيل الـ Service Worker والإشعارات من جهة التطبيق

import { registerSW } from 'virtual:pwa-register';
import { runReminders } from './reminderRunner.js';

export function initPWA() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });

  // افحص التنبيهات عند فتح التطبيق وكل ما يرجع له المستخدم
  const check = () => checkReminders().catch(console.error);
  navigator.serviceWorker.ready.then(check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator;

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') await registerPeriodicSync();
  return result;
}

export async function checkReminders() {
  if (!notificationsSupported() || Notification.permission !== 'granted') return [];
  const reg = await navigator.serviceWorker.ready;
  return runReminders((title, options) => reg.showNotification(title, options));
}

/** فحص يومي بالخلفية حتى لو التطبيق مقفل (متاح على Chrome أندرويد للتطبيق المثبت) */
async function registerPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await reg.periodicSync.register('damani-reminders', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export async function sendTestNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('ضماني يشتغل ✅', {
    body: 'كذا بتوصلك التنبيهات قبل ما ينتهي أي ضمان.',
    dir: 'rtl',
    lang: 'ar',
    icon: '/icons/icon-192.png',
  });
}
