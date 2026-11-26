import { useEffect, useState } from 'react';

/** يحوّل Blob إلى رابط مؤقت للعرض، وينظفه لما يتغير أو تنقفل الشاشة */
export function useObjectURL(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
