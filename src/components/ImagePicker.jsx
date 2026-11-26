import { useRef, useState } from 'react';
import { IMAGE_KINDS } from '../lib/constants.js';
import { compressImage } from '../lib/image.js';
import { CameraIcon, ImageIcon, XIcon } from './Icons.jsx';
import Thumb from './Thumb.jsx';
import ImageViewer from './ImageViewer.jsx';

/**
 * اختيار الصور لكل نوع (فاتورة / بطاقة ضمان / منتج).
 * images: [{ key, kind, blob, id? }]  (id موجود = صورة محفوظة مسبقاً)
 */
export default function ImagePicker({ images, onAdd, onRemove }) {
  const [viewing, setViewing] = useState(null);
  return (
    <div className="space-y-4">
      {IMAGE_KINDS.map((kind) => (
        <KindRow
          key={kind.id}
          kind={kind}
          images={images.filter((i) => i.kind === kind.id)}
          onAdd={onAdd}
          onRemove={onRemove}
          onView={setViewing}
        />
      ))}
      <ImageViewer blob={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function KindRow({ kind, images, onAdd, onRemove, onView }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(e) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    for (const f of files) onAdd(kind.id, await compressImage(f));
    setBusy(false);
  }

  return (
    <div>
      <p className="label">
        صورة {kind.label}
        {kind.id === 'invoice' && <span className="text-slate-400"> (ننصح فيها)</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {images.map((img) => (
          <div key={img.key} className="relative">
            <Thumb blob={img.blob} alt={kind.label} onClick={() => onView(img.blob)} />
            <button
              type="button"
              onClick={() => onRemove(img)}
              className="absolute -top-2 -left-2 flex size-7 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-white dark:ring-slate-950"
              aria-label="حذف الصورة"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => cameraRef.current.click()} disabled={busy} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700">
          <CameraIcon />
          صوّر
        </button>
        <button type="button" onClick={() => galleryRef.current.click()} disabled={busy} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700">
          <ImageIcon />
          من الصور
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFiles} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
    </div>
  );
}
