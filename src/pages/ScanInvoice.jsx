import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Thumb from '../components/Thumb.jsx';
import { CameraIcon, FileIcon, ImageIcon } from '../components/Icons.jsx';
import { compressImage } from '../lib/image.js';
import { parseInvoiceText } from '../lib/invoiceParser.js';
import { decodeZatcaQR } from '../lib/zatca.js';
import { mergePrefill, ocrToPrefill, zatcaToPrefill } from '../lib/prefill.js';
import { toISODate, today } from '../lib/dates.js';
import { recognizeInvoice } from '../services/ocr.js';
import { PRODUCT_FORMATS, QR_FORMATS, scanImage } from '../services/scanner.js';
import { setDraft } from '../services/draft.js';

const isPdf = (f) => f?.type === 'application/pdf' || /\.pdf$/i.test(f?.name ?? '');

export default function ScanInvoice() {
  const navigate = useNavigate();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const pdfRef = useRef(null);
  const [image, setImage] = useState(null);
  const [progress, setProgress] = useState(null); // { stage, progress }
  const [error, setError] = useState(null);

  async function onFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setError(null);
    try {
      let file = picked;
      let pdfText = null;
      if (isPdf(picked)) {
        // ملف PDF: نستخرج النص منه مباشرة ونرسم الصفحة الأولى كصورة
        setProgress({ stage: 'pdf', progress: 0 });
        const { readPdfInvoice } = await import('../services/pdfImport.js');
        const pdf = await readPdfInvoice(picked);
        file = pdf.image;
        pdfText = pdf.text;
      }
      setImage(file);
      setProgress({ stage: pdfText ? 'pdf' : 'loading', progress: 0 });
      // نقرأ QR الفاتورة وباركود المنتج (لو موجودين في الصورة) والنص بالتوازي
      const [qrText, barText, text] = await Promise.all([
        scanImage(file, QR_FORMATS).catch(() => null),
        scanImage(file, PRODUCT_FORMATS).catch(() => null),
        pdfText ?? recognizeInvoice(file, setProgress),
      ]);
      const zatca = qrText ? decodeZatcaQR(qrText) : null;
      const ocr = parseInvoiceText(text, toISODate(today()));
      const prefill = mergePrefill(ocrToPrefill(ocr), zatca ? zatcaToPrefill(zatca) : {});
      if (barText && /^\d{8,14}$/.test(barText)) prefill.barcode = barText;
      setDraft({
        source: (pdfText ? 'pdf' : 'ocr') + (zatca ? '+qr' : ''),
        prefill,
        items: ocr.items,
        images: [{ kind: 'invoice', blob: await compressImage(file) }],
        rawText: text,
      });
      navigate('/add/manual', { replace: true });
    } catch (err) {
      console.error(err);
      setProgress(null);
      setError(
        isPdf(picked)
          ? 'ما قدرنا نفتح ملف PDF. تأكد إنه فاتورة وما عليه كلمة سر، أو خذ لقطة شاشة واختارها كصورة.'
          : navigator.onLine
            ? 'صار خطأ أثناء قراءة الفاتورة. جرّب مرة ثانية أو استخدم الإدخال اليدوي.'
            : 'أول مرة تحتاج إنترنت لتحميل ملفات قراءة النص العربي. اتصل بالإنترنت وحاول مرة ثانية.'
      );
    }
  }

  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <>
      <PageHeader title="تصوير الفاتورة" back />
      <div className="space-y-4 px-4">
        {!progress && (
          <>
            <div className="card p-4 text-slate-600 dark:text-slate-400">
              <p className="mb-2 font-semibold text-slate-800 dark:text-slate-200">لأفضل نتيجة:</p>
              <ul className="space-y-1 text-sm">
                <li>• حط الفاتورة على سطح مستوي بإضاءة جيدة</li>
                <li>• صوّر الفاتورة كاملة وبشكل مستقيم</li>
                <li>• لو فيها QR بيكون أدق، ونقرأه تلقائياً من نفس الصورة</li>
                <li>• فواتير المتاجر الإلكترونية (نون، أمازون...): اختر ملف الـ PDF مباشرة</li>
              </ul>
            </div>
            <button className="btn-primary w-full text-lg" onClick={() => cameraRef.current.click()}>
              <CameraIcon />
              صوّر الفاتورة
            </button>
            <button className="btn-secondary w-full" onClick={() => galleryRef.current.click()}>
              <ImageIcon className="size-5" />
              اختر صورة من جهازك
            </button>
            <button className="btn-secondary w-full" onClick={() => pdfRef.current.click()}>
              <FileIcon className="size-5" />
              اختر ملف PDF
            </button>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
          </>
        )}

        {progress && (
          <div className="card flex flex-col items-center gap-4 p-6 text-center">
            {image && <Thumb blob={image} alt="الفاتورة" className="h-48 w-36" />}
            <p className="font-semibold">
              {progress.stage === 'pdf' ? 'نفتح ملف PDF…' : progress.stage === 'recognizing' ? 'نقرأ الفاتورة…' : 'نجهّز القارئ… (أول مرة تاخذ وقت أطول)'}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress.stage === 'recognizing' ? pct : Math.max(5, pct / 3)}%` }} />
            </div>
            <p className="num text-sm text-slate-500">{progress.stage === 'recognizing' ? `${pct}%` : ''}</p>
          </div>
        )}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFile} />
    </>
  );
}
