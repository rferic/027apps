import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function deriveKey(): Buffer {
  const raw = process.env.VAULT_SECRET
  if (!raw) throw new Error('VAULT_SECRET environment variable is not set')
  return crypto.scryptSync(raw, 'github-integration-salt', 32)
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return iv.toString('hex') + ':' + tag + ':' + encrypted
}

export function decryptSecret(encoded: string): string {
  const key = deriveKey()
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format')
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
