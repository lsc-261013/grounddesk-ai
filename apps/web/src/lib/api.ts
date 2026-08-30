import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

const errorMessage = async (response: Response): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null)
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message: unknown = Reflect.get(payload, 'message')
    if (typeof message === 'string') return message
  }
  return `API request failed with status ${response.status}.`
}

export const workspaceId = (): string => {
  const id = useAuthStore().activeMembership?.workspace.id
  if (!id) throw new Error('Workspace membership is unavailable.')
  return id
}

export const authenticatedApi = async (path: string, init?: RequestInit): Promise<Response> => {
  const accessToken = useAuthStore().accessToken
  if (!accessToken) throw new Error('Authentication session is unavailable.')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...init?.headers,
      authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return response
}
