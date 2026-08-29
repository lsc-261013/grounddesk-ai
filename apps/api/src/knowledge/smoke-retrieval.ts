import { DEMO_WORKSPACE_ID, type Locale } from '@grounddesk/shared'

import { env } from '../config/env.js'
import { createKnowledgeDependencies } from './dependencies.js'

interface RetrievalCase {
  caseKey: string
  query: string
  language: Locale
  expectedDocument: string
}

const cases: readonly RetrievalCase[] = [
  {
    caseKey: 'zh_similar_model_multipoint',
    query: 'Airwave S1 支持同时连接两台设备吗？S1 Pro 呢？',
    language: 'zh-CN',
    expectedDocument: 'Avenlo 产品与兼容性手册',
  },
  {
    caseKey: 'en_cable_warranty',
    query: 'How long is the warranty for a LinkCore C240 cable?',
    language: 'en-US',
    expectedDocument: 'Avenlo Shipping, Returns, and Warranty Policy',
  },
  {
    caseKey: 'zh_battery_air_travel',
    query: 'Reserve 10K 移动电源可以放进托运行李吗？',
    language: 'zh-CN',
    expectedDocument: 'Avenlo 配送、退货与保修政策',
  },
]

const dependencies = createKnowledgeDependencies(env)

try {
  const results = []

  for (const retrievalCase of cases) {
    const evidence = await dependencies.knowledgeService.search({
      workspaceId: DEMO_WORKSPACE_ID,
      query: retrievalCase.query,
      language: retrievalCase.language,
      productModel: null,
      limit: 5,
    })
    const matched = evidence.some(
      (candidate) => candidate.documentTitle === retrievalCase.expectedDocument,
    )
    if (!matched) {
      throw new Error(
        `Expected evidence was not retrieved for ${retrievalCase.caseKey}: ${JSON.stringify(
          evidence.map((candidate) => candidate.documentTitle),
        )}`,
      )
    }

    results.push({
      caseKey: retrievalCase.caseKey,
      matched,
      candidates: evidence.map((candidate) => ({
        documentTitle: candidate.documentTitle,
        sectionPath: candidate.sectionPath,
        fusedScore: candidate.fusedScore,
        vectorSimilarity: candidate.vectorSimilarity,
        keywordScore: candidate.keywordScore,
        vectorRank: candidate.vectorRank,
        keywordRank: candidate.keywordRank,
      })),
    })
  }

  process.stdout.write(
    `${JSON.stringify({ valid: true, retrievalAt5: '3/3', results }, null, 2)}\n`,
  )
} finally {
  await dependencies.knowledgeService.close()
}
