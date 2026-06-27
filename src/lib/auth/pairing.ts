import crypto from 'crypto'

export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generatePairingCode(secret: string): string {
  const minutes = Math.floor(Date.now() / 60000)
  const hash = crypto.createHmac('sha256', secret).update(String(minutes)).digest('hex')
  const num = parseInt(hash.slice(0, 6), 16)
  return String(num % 1000000).padStart(6, '0')
}

export function verifyPairingCode(secret: string, code: string): boolean {
  // Check current and previous minute (allow 1-min clock skew)
  const current = generatePairingCode(secret)
  if (current === code) return true

  // Generate code for previous minute (in case of refresh timing)
  const originalGetTime = Date.prototype.getTime
  const previous = (() => {
    const fake = Date.now() - 60000
    const minutes = Math.floor(fake / 60000)
    const hash = crypto.createHmac('sha256', secret).update(String(minutes)).digest('hex')
    const num = parseInt(hash.slice(0, 6), 16)
    return String(num % 1000000).padStart(6, '0')
  })()

  return previous === code
}
