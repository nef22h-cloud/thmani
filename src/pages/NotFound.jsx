import { Link } from 'react-router-dom';

export default function NotFound({ message = 'الصفحة غير موجودة' }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">{message}</p>
      <Link to="/" className="btn-primary">الرجوع للرئيسية</Link>
    </div>
  );
}
