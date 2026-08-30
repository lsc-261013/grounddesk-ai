import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const isPrivateIpv4 = (address: string): boolean => {
  const octets = address.split('.').map(Number)
  const [first, second] = octets
  if (octets.length !== 4 || first === undefined || second === undefined) return true
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  )
}

const isPrivateIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase()
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

export type HostResolver = (hostname: string) => Promise<string[]>

const resolveHost: HostResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true })
  return results.map((result) => result.address)
}

export const assertSafeWebhookUrl = async (
  rawUrl: string,
  production: boolean,
  resolver: HostResolver = resolveHost,
): Promise<URL> => {
  const url = new URL(rawUrl)
  if (url.username || url.password) throw new Error('Webhook URLs cannot contain credentials.')
  if (production ? url.protocol !== 'https:' : !['http:', 'https:'].includes(url.protocol)) {
    throw new Error(production ? 'Production webhooks require HTTPS.' : 'Use HTTP or HTTPS.')
  }
  if (url.port && Number(url.port) <= 0) throw new Error('The webhook port is invalid.')
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Webhook URLs cannot target local hosts.')
  }
  const addresses = isIP(hostname) ? [hostname] : await resolver(hostname)
  if (addresses.length === 0) throw new Error('The webhook host could not be resolved.')
  if (
    addresses.some((address) =>
      isIP(address) === 4 ? isPrivateIpv4(address) : isIP(address) === 6 && isPrivateIpv6(address),
    )
  ) {
    throw new Error('Webhook URLs cannot target private or reserved networks.')
  }
  return url
}
