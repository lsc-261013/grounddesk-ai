// @vitest-environment happy-dom

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
