// @vitest-environment happy-dom

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useShowcaseStore } from '../src/stores/showcase'

const demoProduct = {
  id: '30000000-0000-4000-8000-000000000001',
  sku: 'AVL-DOCK-12',
  model: 'ArcDock 12',
  category: 'desktop_dock',
  nameZh: 'ArcDock 12 桌面扩展坞',
  nameEn: 'ArcDock 12 Desktop Dock',
  descriptionZh: '面向桌面连接和供电场景的十二合一扩展坞。',
  descriptionEn: 'A twelve-in-one dock for desktop connectivity and power.',
  priceCents: 12900,
  currency: 'USD',
  specs: { powerDelivery: '100W' },
}

describe('public showcase loading', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('keeps successful product data when the evaluation endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.endsWith('/products')) {
          return Promise.resolve(
            new Response(JSON.stringify({ products: [demoProduct] }), { status: 200 }),
          )
        }

        return Promise.resolve(new Response('Service unavailable', { status: 503 }))
      }),
    )

    const store = useShowcaseStore()
    await store.load()

    expect(store.products).toHaveLength(1)
    expect(store.productError).toBeNull()
    expect(store.evaluation).toBeNull()
    expect(store.evaluationError).toBe('Public evaluation data is temporarily unavailable.')
  })
})

describe('public loading recovery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shares in-flight reads, shows slow state, times out and permits a clean retry', async () => {
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const store = useShowcaseStore()
    const first = store.loadProducts()
    const duplicate = store.loadProducts(true)
    void duplicate
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(8_000)
    expect(store.isProductsSlow).toBe(true)
    expect(store.productError).toBeNull()
    await vi.advanceTimersByTimeAsync(52_000)
    await first
    expect(store.isProductsLoading).toBe(false)
    expect(store.isProductsSlow).toBe(false)
    expect(store.productError).toBeTruthy()
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ products: [demoProduct] })))
    await store.loadProducts(true)
    expect(store.products).toHaveLength(1)
    expect(store.productError).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds a stalled response body and preserves independent successful data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        Promise.resolve({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) =>
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              ),
            ),
        }),
      ),
    )
    const store = useShowcaseStore()
    store.products = [demoProduct]
    const pending = store.loadEvaluation()
    await vi.advanceTimersByTimeAsync(60_000)
    await pending
    expect(store.evaluationError).toBeTruthy()
    expect(store.isEvaluationLoading).toBe(false)
    expect(store.products).toHaveLength(1)
  })

  it('distinguishes completed empty data from failed reads without refetching on navigation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"products":[]}'))
      .mockResolvedValueOnce(new Response('{"evaluation":null}'))
    vi.stubGlobal('fetch', fetch)
    const store = useShowcaseStore()
    await store.load()
    await store.load()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(store.error).toBeNull()
    expect(store.isLoading).toBe(false)
  })
})
