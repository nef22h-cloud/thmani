import { useEffect } from 'react';
import { useObjectURL } from '../hooks/useObjectURL.js';
import { XIcon } from './Icons.jsx';

/** عرض الصورة بملء الشاشة */
export default function ImageViewer({ blob, onClose }) {
  const url = useObjectURL(blob);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!blob) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <button className="absolute top-4 left-4 flex size-12 items-center justify-center rounded-full bg-white/10 text-white" style={{ marginTop: 'env(safe-area-inset-top)' }} aria-label="إغلاق">
        <XIcon />
      </button>
      {url && <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />}
    </div>
  );
}
