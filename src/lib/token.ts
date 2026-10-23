import { createHmac, timingSafeEqual } from 'node:crypto'

/** Fails closed: an empty secret would let anyone forge a session. */
export function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is missing or shorter than 16 characters')
  return secret
}

const sign = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('base64url')

export function safeEqual(a: string, b: string) {
  const [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Session token: `<userId>.<expiresAtMs>.<signature>`. */
export function createToken(secret: string, userId: number, ttlMs: number, now = Date.now()) {
  const data = `${userId}.${now + ttlMs}`
  return `${data}.${sign(secret, data)}`
}

/** The user id inside a token, or null if it is forged, malformed or expired. */
export function readToken(secret: string, token: string | undefined, now = Date.now()) {
  const [id, expires, signature] = token?.split('.') ?? []
  if (!signature || !safeEqual(signature, sign(secret, `${id}.${expires}`))) return null
  return Number(expires) > now ? Number(id) : null
}

/** Shared secret the Services put in their webhook URL so only they can call Arrmy's hook. */
export const hookToken = (secret: string) => sign(secret, 'hook')

/** Shared secret in the AudioBook Bay relay's address (see abbrelay.ts). scripts/init.mjs derives the same. */
export const audiobookBayToken = (secret: string) => sign(secret, 'audiobookbay')

/** Shared secret Arrmy sends The Doctarr (see doctor.ts). scripts/doctor.mjs derives the same. */
export const doctorToken = (secret: string) => sign(secret, 'doctor')

/** LazyLibrarian's API key, derived so nobody has to set one. scripts/init.mjs writes the same value into its config. */
export const lazyLibrarianKey = (secret: string) => createHmac('sha256', secret).update('lazylibrarian').digest('hex').slice(0, 32)

/** Tautulli's API key, derived the same way; scripts/init.mjs writes it into Tautulli's config. Tautulli wants 32 characters. */
export const tautulliKey = (secret: string) => createHmac('sha256', secret).update('tautulli').digest('hex').slice(0, 32)
