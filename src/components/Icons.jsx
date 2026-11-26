// أيقونات SVG بسيطة (بدون مكتبة خارجية عشان الحجم)
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };
const I = (paths) =>
  function Icon({ className = 'size-6', ...props }) {
    return (
      <svg {...base} className={className} aria-hidden="true" {...props}>
        {paths}
      </svg>
    );
  };

export const HomeIcon = I(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>);
export const PlusIcon = I(<path d="M12 5v14M5 12h14" />);
export const SettingsIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const BackIcon = I(<path d="m9 18 6-6-6-6" />); // سهم لليمين (رجوع في RTL)
export const ChevronIcon = I(<path d="m15 18-6-6 6-6" />);
export const SearchIcon = I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const QrIcon = I(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></>);
export const BarcodeIcon = I(<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14" />);
export const CameraIcon = I(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const EditIcon = I(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>);
export const TrashIcon = I(<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>);
export const PhoneIcon = I(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />);
export const ShareIcon = I(<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>);
export const FileIcon = I(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>);
export const ShieldIcon = I(<><path d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>);
export const BellIcon = I(<><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const ImageIcon = I(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>);
export const XIcon = I(<path d="M6 6l12 12M18 6 6 18" />);
export const ClaimIcon = I(<><path d="M9 4h6l1 2h3v15H5V6h3z" /><path d="m9 13 2 2 4-4" /></>);
export const DownloadIcon = I(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>);
export const UploadIcon = I(<><path d="M12 15V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>);
export const CloudIcon = I(<><path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" /><path d="m9.5 13.5 2 2 3.5-3.5" /></>);
export const LockIcon = I(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const FingerprintIcon = I(<><path d="M12 11v3a8 8 0 0 1-1.5 4.5" /><path d="M8.5 8.5A5 5 0 0 1 17 12v1.5a12 12 0 0 1-.7 4" /><path d="M5.5 15.5A10 10 0 0 1 5 12a7 7 0 0 1 11.5-5.3" /><path d="M9 12a3 3 0 0 1 6 0v1a14 14 0 0 1-1.2 5.8" /></>);
export const DeleteKeyIcon = I(<><path d="M20 6H9l-6 6 6 6h11z" /><path d="m12 9 6 6M18 9l-6 6" /></>);
