import { SignJWT, jwtVerify } from 'jose'
import { sessionUserSchema, type SessionUser } from '@beverly-call/shared'

const ISSUER = 'beverly-call'

/** Issues the signed session cookie value. The Beverly bearer token never reaches the browser. */
export async function signSession(user: SessionUser, beverlyToken: string, secret: string, ttlMinutes: number): Promise<string> {
  return new SignJWT({ user, bt: beverlyToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(new TextEncoder().encode(secret))
}

export interface VerifiedSession { user: SessionUser; beverlyToken: string }

export async function verifySession(token: string, secret: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: ISSUER })
    const user = sessionUserSchema.safeParse(payload.user)
    if (!user.success || typeof payload.bt !== 'string') return null
    return { user: user.data, beverlyToken: payload.bt }
  } catch {
    return null
  }
}
