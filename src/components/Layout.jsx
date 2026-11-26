import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { ClaimIcon, HomeIcon, PlusIcon, SettingsIcon } from './Icons.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  // نخفي الشريط السفلي في النماذج عشان زر الحفظ يكون واضح
  const hideNav = pathname.startsWith('/add/') || pathname.endsWith('/edit') || pathname.includes('/claims/');

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
  const openClaims = useLiveQuery(() => db.claims.where('status').anyOf('open', 'inProgress').count(), [], 0);
  const item = ({ isActive }) =>
    `relative flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
      isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
    }`;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-end px-2">
        <NavLink to="/" end className={item}>
          <HomeIcon />
          الرئيسية
        </NavLink>
        <NavLink to="/add" className={item} aria-label="إضافة ضمان">
          <span className="-my-1 flex size-8 items-center justify-center rounded-full bg-brand-700 text-white dark:bg-brand-600">
            <PlusIcon className="size-5" />
          </span>
          إضافة
        </NavLink>
        <NavLink to="/claims" className={item}>
          <span className="relative">
            <ClaimIcon />
            {openClaims > 0 && (
              <span className="absolute -top-1.5 -left-2 flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] leading-5 font-bold text-white" aria-label={`${openClaims} مطالبة مفتوحة`}>
                {openClaims}
              </span>
            )}
          </span>
          المطالبات
        </NavLink>
        <NavLink to="/settings" className={item}>
          <SettingsIcon />
          الإعدادات
        </NavLink>
      </div>
    </nav>
  );
}
