import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import CameraScanner from '../components/CameraScanner.jsx';
import { PRODUCT_FORMATS } from '../services/scanner.js';
import { lookupProduct, productDisplayName } from '../services/productLookup.js';
import { setDraft } from '../services/draft.js';

export default function ScanBarcode() {
  const navigate = useNavigate();
  const [looking, setLooking] = useState(null);

  async function onDetect(code, image) {
    navigator.vibrate?.(60);
    setLooking(code);
    const product = await lookupProduct(code);
    setDraft({
      source: 'barcode',
      prefill: { barcode: code, ...(product ? { productName: productDisplayName(product) } : {}) },
      images: image ? [{ kind: 'product', blob: image }] : [],
      notFound: !product,
    });
    navigate('/add/manual', { replace: true });
    return true;
  }

  return (
    <>
      <PageHeader title="مسح باركود المنتج" back />
      <div className="px-4">
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          امسح الباركود اللي على كرتون المنتج. بنحفظ الرقم ونحاول نجيب اسم المنتج.
        </p>
        {looking ? (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <div className="size-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
            <p className="font-semibold">نبحث عن المنتج…</p>
            <p className="num text-sm text-slate-500" dir="ltr">{looking}</p>
          </div>
        ) : (
          <CameraScanner formats={PRODUCT_FORMATS} onDetect={onDetect} shape="wide" hint="خلّ الباركود داخل الإطار" />
        )}
      </div>
    </>
  );
}
