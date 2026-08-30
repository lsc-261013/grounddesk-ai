import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

const VERSION = 'v1'

const encryptionKey = (masterSecret: string): Buffer =>
  createHash('sha256').update(`grounddesk:webhook-encryption:${masterSecret}`).digest()

export const encryptWebhookSecret = (secret: string, masterSecret: string): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(masterSecret), iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export const decryptWebhookSecret = (value: string, masterSecret: string): string => {
  const [version, ivValue, tagValue, encryptedValue, extra] = value.split(':')
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue || extra) {
    throw new Error('The encrypted webhook secret has an unsupported format.')
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(masterSecret),
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export const createWebhookSignature = (
  signingSecret: string,
  timestamp: string,
  body: string,
): string =>
  `sha256=${createHmac('sha256', signingSecret).update(`${timestamp}.${body}`).digest('hex')}`
