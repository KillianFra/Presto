import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keyLength = 64
const algorithm = 'scrypt'

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer

  return `${algorithm}:${salt}:${derivedKey.toString('base64url')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [storedAlgorithm, salt, storedKey] = storedHash.split(':')

  if (storedAlgorithm !== algorithm || !salt || !storedKey) {
    return false
  }

  const storedKeyBuffer = Buffer.from(storedKey, 'base64url')
  const derivedKey = await scrypt(password, salt, storedKeyBuffer.length) as Buffer

  if (storedKeyBuffer.length !== derivedKey.length) {
    return false
  }

  return timingSafeEqual(storedKeyBuffer, derivedKey)
}
