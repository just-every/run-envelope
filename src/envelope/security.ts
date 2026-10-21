export class PayrollError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code)
  }
}
const encoder = new TextEncoder()
export async function recordKey(value?: string) {
  // Dedicated installation key; no session-secret fallback or development key.
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new PayrollError('payroll_record_key_required', 503)
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
  if (bytes.length !== 32) throw new PayrollError('payroll_record_key_required', 503)
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function seal(key: CryptoKey, context: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const bytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(value),
  )
  return JSON.stringify({
    v: 1,
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(bytes))),
  })
}
export async function unseal(key: CryptoKey, context: string, cipher: string) {
  const value = JSON.parse(cipher)
  if (value.v !== 1) throw new PayrollError('private_record_unavailable', 503)
  try {
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: Uint8Array.from(atob(value.iv), (c) => c.charCodeAt(0)),
          additionalData: encoder.encode(context),
        },
        key,
        Uint8Array.from(atob(value.data), (c) => c.charCodeAt(0)),
      ),
    )
  } catch {
    throw new PayrollError('private_record_unavailable', 503)
  }
}
export const text = (value: unknown, max = 120): string => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new PayrollError('invalid_input')
  return value.trim()
}
export const integer = (value: unknown): number => {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(n) || Number(n) < 1 || Number(n) > 100_000_000)
    throw new PayrollError('invalid_input')
  return Number(n)
}
export function date(value: unknown) {
  const v = text(value, 10)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(new Date(v).getTime()) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw new PayrollError('invalid_effective_date')
  return v
}
