// رمز القفل: نحفظ hash (PBKDF2-SHA256 مع salt) وليس الرمز نفسه.

const ITERATIONS = 150_000;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const isValidPin = (pin) => /^\d{4,6}$/.test(pin);

export async function hashPin(pin, saltB64, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations }, key, 256);
  return toB64(bits);
}

/** يرجع إعدادات القفل الجديدة لرمز */
export async function createPinRecord(pin) {
  if (!isValidPin(pin)) throw new Error('invalid pin');
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPin(pin, salt), iterations: ITERATIONS, pinLength: pin.length };
}

export async function verifyPin(pin, record) {
  if (!record?.hash || !isValidPin(pin)) return false;
  const h = await hashPin(pin, record.salt, record.iterations ?? ITERATIONS);
  // مقارنة بزمن ثابت
  if (h.length !== record.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return diff === 0;
}

/** رموز سهلة التخمين نرفضها */
export function isWeakPin(pin) {
  if (/^(\d)\1+$/.test(pin)) return true; // 0000, 1111
  const asc = '0123456789012345';
  const desc = '9876543210987654';
  return asc.includes(pin) || desc.includes(pin);
}

/** مدة الانتظار بعد المحاولات الغلط (بالثواني): بعد 5 غلطات 30 ثانية، وتتضاعف */
export function lockoutSeconds(failedAttempts) {
  if (failedAttempts < 5) return 0;
  return Math.min(30 * 2 ** Math.floor((failedAttempts - 5) / 3), 15 * 60);
}

/** هل لازم نقفل بعد الرجوع للتطبيق؟ timeoutMin = 0 يعني فوراً */
export function shouldLockAfter(hiddenAt, now, timeoutMin) {
  if (hiddenAt == null) return false;
  return now - hiddenAt >= timeoutMin * 60_000;
}
