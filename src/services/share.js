// حفظ/مشاركة ملف: على الجوال قائمة المشاركة (واتساب، الملفات، iCloud...)، وإلا تحميل عادي.

const isMobile = () =>
  /android|iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.userAgent));

/** يرجع 'shared' | 'downloaded' | 'cancelled' */
export async function shareOrDownload(file, { title, text, downloadName } = {}) {
  if (isMobile() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // نكمل للتحميل العادي
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  // بعض المتصفحات ترفض الأسماء غير الإنجليزية في التحميل، فنستخدم اسم بديل لو موجود
  a.download = downloadName || file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** اسم ملف آمن (بدون رموز تخرّب المسار) */
export const safeFileName = (s) => String(s).replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'ملف';
