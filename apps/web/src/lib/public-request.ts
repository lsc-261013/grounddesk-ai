export const PUBLIC_REQUEST_TIMEOUT_MS = 60_000
export const PUBLIC_REQUEST_SLOW_MS = 8_000

// Keep the timeout active until the body is read, not only until headers arrive.
export const readPublicJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PUBLIC_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Public request failed with status ${response.status}.`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}
