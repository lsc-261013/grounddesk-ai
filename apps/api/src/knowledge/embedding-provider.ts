import { z } from 'zod'

export interface EmbeddingProvider {
  readonly model: string
  readonly dimensions: number
  embed(texts: readonly string[]): Promise<number[][]>
}

const embeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number()),
    }),
  ),
})

const wait = async (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

export class SiliconFlowEmbeddingProvider implements EmbeddingProvider {
  constructor(
    readonly model: string,
    readonly dimensions: number,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    if (texts.some((text) => text.trim().length === 0)) {
      throw new Error('Embedding input must not be empty.')
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/embeddings`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: this.model, input: texts }),
          signal: AbortSignal.timeout(this.timeoutMs),
        })

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500
          const error = new Error(`Embedding provider returned status ${response.status}.`)
          if (!retryable) throw error
          lastError = error
        } else {
          const payload = embeddingResponseSchema.parse(await response.json())
          const ordered = [...payload.data].sort((left, right) => left.index - right.index)

          if (ordered.length !== texts.length) {
            throw new Error('Embedding provider returned an unexpected result count.')
          }

          for (const item of ordered) {
            if (item.embedding.length !== this.dimensions) {
              throw new Error(
                `Embedding dimension mismatch: expected ${this.dimensions}, received ${item.embedding.length}.`,
              )
            }
          }

          return ordered.map((item) => item.embedding)
        }
      } catch (cause) {
        lastError = cause instanceof Error ? cause : new Error('Unknown embedding provider error.')
      }

      if (attempt < 2) await wait(attempt === 0 ? 300 : 800)
    }

    throw lastError ?? new Error('Embedding provider request failed.')
  }
}
