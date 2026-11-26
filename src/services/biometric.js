// فتح القفل بـ Face ID / البصمة عبر WebAuthn (مفتاح مرور على الجهاز).
// ما فيه سيرفر: نستخدمه كتأكيد محلي إن صاحب الجهاز موجود (userVerification: required).

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function biometricAvailable() {
  try {
    return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch {
    return false;
  }
}

/** يسجّل مفتاح على الجهاز. يرجع credentialId (base64url) */
export async function registerBiometric() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'ضماني', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'damani-lock', displayName: 'قفل ضماني' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  });
  return b64url(cred.rawId);
}

/** يطلب Face ID / البصمة. يرجع true لو نجح */
export async function verifyBiometric(credentialId) {
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return Boolean(res);
  } catch {
    return false;
  }
}
