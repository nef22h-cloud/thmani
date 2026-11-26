import { useNavigate } from 'react-router-dom';
import { BackIcon } from './Icons.jsx';

export default function PageHeader({ title, back = false, action }) {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-2 bg-slate-50/90 px-4 py-3 backdrop-blur dark:bg-slate-950/90"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      {back && (
        <button
          onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}
          className="-ms-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800"
          aria-label="رجوع"
        >
          <BackIcon />
        </button>
      )}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </header>
  );
}
