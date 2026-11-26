// ثوابت التطبيق المشتركة

export const CATEGORIES = [
  { id: 'electronics', label: 'أجهزة إلكترونية', icon: '💻' },
  { id: 'appliances', label: 'أجهزة منزلية', icon: '🧺' },
  { id: 'phones', label: 'جوالات', icon: '📱' },
  { id: 'furniture', label: 'أثاث', icon: '🛋️' },
  { id: 'cars', label: 'سيارات', icon: '🚗' },
  { id: 'other', label: 'أخرى', icon: '📦' },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES.at(-1);

export const STATUS = {
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  CLAIMED: 'claimed',
};

export const STATUS_LABELS = {
  active: 'ساري',
  expiring: 'قرب ينتهي',
  expired: 'منتهي',
  claimed: 'تم استخدامه في مطالبة',
};

export const IMAGE_KINDS = [
  { id: 'invoice', label: 'الفاتورة' },
  { id: 'warrantyCard', label: 'بطاقة الضمان' },
  { id: 'product', label: 'المنتج' },
];

export const DEFAULT_SETTINGS = {
  // كم يوم قبل الانتهاء نرسل تنبيه
  warrantyReminderDays: [30, 7, 1],
  returnReminderDays: [1],
  // أقل من هذا العدد من الأيام = "قرب ينتهي"
  expiringThresholdDays: 30,
  notificationsEnabled: false,
  showHijri: false,
  theme: 'system', // system | light | dark
  lastBackupAt: null,
  backupReminderDismissedAt: null,
  // قفل التطبيق (خاص بالجهاز، ما ينتقل في النسخة الاحتياطية)
  lock: null,
};
