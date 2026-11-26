// مسودة مؤقتة تنتقل من شاشات المسح إلى نموذج الإضافة.
// نحفظها في الذاكرة بدل history.state لأن فيها صور (Blob).
//
// draft: { source: 'qr'|'barcode'|'ocr'|'ocr+qr', prefill: {...}, images: [{kind, blob}], rawText?, notFound? }

let draft = null;

export function setDraft(d) {
  draft = d;
}
export const peekDraft = () => draft;
export function clearDraft() {
  draft = null;
}
