import { createClient } from '@supabase/supabase-js'

export const KNOWLEDGE_BUCKET = 'grounddesk-knowledge'

export interface KnowledgeStorage {
  upload(path: string, bytes: Buffer, mimeType: string): Promise<void>
  download(path: string): Promise<Buffer>
  remove(path: string): Promise<void>
}

export const createSupabaseKnowledgeStorage = (
  supabaseUrl: string,
  secretKey: string,
): KnowledgeStorage => {
  const client = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  return {
    async upload(path: string, bytes: Buffer, mimeType: string): Promise<void> {
      const { error } = await client.storage.from(KNOWLEDGE_BUCKET).upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      })
      if (error) throw new Error(`Document storage upload failed: ${error.message}`)
    },

    async download(path: string): Promise<Buffer> {
      const { data, error } = await client.storage.from(KNOWLEDGE_BUCKET).download(path)
      if (error) throw new Error(`Document storage download failed: ${error.message}`)
      return Buffer.from(await data.arrayBuffer())
    },

    async remove(path: string): Promise<void> {
      const { error } = await client.storage.from(KNOWLEDGE_BUCKET).remove([path])
      if (error) throw new Error(`Document storage cleanup failed: ${error.message}`)
    },
  }
}
