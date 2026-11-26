import { useObjectURL } from '../hooks/useObjectURL.js';

export default function Thumb({ blob, alt, onClick, className = 'size-20' }) {
  const url = useObjectURL(blob);
  if (!url) return <div className={`${className} animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800`} />;
  return (
    <button type="button" onClick={onClick} className={`${className} overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-slate-700`}>
      <img src={url} alt={alt} className="size-full object-cover" />
    </button>
  );
}
