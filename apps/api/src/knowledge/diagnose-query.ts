import { DEMO_WORKSPACE_ID, localeSchema } from '@grounddesk/shared'

import { env } from '../config/env.js'
import { createKnowledgeDependencies } from './dependencies.js'

const query = process.argv[2]
const locale = localeSchema.parse(process.argv[3] ?? 'zh-CN')
if (!query) throw new Error('Pass a retrieval query as the first argument.')

const dependencies = createKnowledgeDependencies(env)
try {
  const trace = await dependencies.knowledgeService.searchWithTrace({
    workspaceId: DEMO_WORKSPACE_ID,
    query,
    language: locale,
    productModel: null,
    limit: 8,
  })
  process.stdout.write(
    `${JSON.stringify(
      {
        query,
        locale,
        durationMs: trace.durationMs,
        evidence: trace.evidence.map((item) => ({
          documentTitle: item.documentTitle,
          sectionPath: item.sectionPath,
          vectorSimilarity: item.vectorSimilarity,
          keywordScore: item.keywordScore,
          vectorRank: item.vectorRank,
          keywordRank: item.keywordRank,
          excerpt: item.content.slice(0, 220),
        })),
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await dependencies.knowledgeService.close()
}
