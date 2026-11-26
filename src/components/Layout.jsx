import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { HomeIcon, PlusIcon, SettingsIcon } from './Icons.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  // نخفي الشريط السفلي في النماذج عشان زر الحفظ يكون واضح
  const hideNav = pathname.startsWith('/add/') || pathname.endsWith('/edit');

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className={hideNav ? 'pb-8' : 'pb-28'}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

function BottomNav() {
  const item = ({ isActive }) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
      isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
    }`;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-end px-6">
        <NavLink to="/" end className={item}>
          <HomeIcon />
          الرئيسية
        </NavLink>
        <NavLink to="/add" className="-mt-6 flex flex-1 flex-col items-center gap-1 pb-2 text-xs font-medium text-brand-700 dark:text-brand-400" aria-label="إضافة ضمان">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-700/30 ring-4 ring-slate-50 dark:bg-brand-600 dark:ring-slate-950">
            <PlusIcon className="size-7" />
          </span>
          إضافة
        </NavLink>
        <NavLink to="/settings" className={item}>
          <SettingsIcon />
          الإعدادات
        </NavLink>
      </div>
    </nav>
  );
}
