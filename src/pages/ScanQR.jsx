import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import CameraScanner from '../components/CameraScanner.jsx';
import Toast from '../components/Toast.jsx';
import { decodeZatcaQR } from '../lib/zatca.js';
import { QR_FORMATS } from '../services/scanner.js';
import { setDraft } from '../services/draft.js';
import { zatcaToPrefill } from '../lib/prefill.js';

export default function ScanQR() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  async function onDetect(text, image) {
    const invoice = decodeZatcaQR(text);
    if (!invoice) {
      setToast('هذا مو QR فاتورة إلكترونية. وجّه الكاميرا على الـ QR اللي أسفل الفاتورة.');
      setTimeout(() => setToast(null), 2500);
      return false;
    }
    navigator.vibrate?.(60);
    setDraft({
      source: 'qr',
      prefill: zatcaToPrefill(invoice),
      images: image ? [{ kind: 'invoice', blob: image }] : [],
    });
    navigate('/add/manual', { replace: true });
    return true;
  }

  return (
    <>
      <PageHeader title="مسح QR الفاتورة" back />
      <div className="px-4">
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          وجّه الكاميرا على رمز QR في الفاتورة الضريبية، وبنعبّي اسم المتجر والتاريخ والمبلغ تلقائياً.
        </p>
        <CameraScanner formats={QR_FORMATS} onDetect={onDetect} hint="خلّ الـ QR داخل المربع" />
      </div>
      <Toast message={toast} />
    </>
  );
}
