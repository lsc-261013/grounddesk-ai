import { ServiceUnavailableError } from '../auth/errors.js'
import type { ApiEnv } from '../config/env.js'
import { DeepSeekGenerationProvider } from '../generation/deepseek-provider.js'
import type { KnowledgeService } from '../knowledge/service.js'
import { createPostgresToolRepository } from '../tools/postgres-tool-repository.js'
import { DefaultToolExecutionService } from '../tools/service.js'
import { createPostgresAgentRepository } from './postgres-agent-repository.js'
import { DefaultAgentService, type AgentService } from './service.js'

export interface AgentDependencies {
  agentService: AgentService
}

class UnavailableAgentService implements AgentService {
  openPublicChat(): ReturnType<AgentService['openPublicChat']> {
    return Promise.reject(
      new ServiceUnavailableError('Public AI chat is unavailable in offline mode.'),
    )
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

export const createAgentDependencies = (
  environment: ApiEnv,
  knowledgeService: KnowledgeService,
): AgentDependencies => {
  if (
    environment.RUNTIME_MODE !== 'connected' ||
    !environment.SUPABASE_DB_URL ||
    !environment.DEEPSEEK_API_KEY
  ) {
    return { agentService: new UnavailableAgentService() }
  }

  const agentRepository = createPostgresAgentRepository(environment.SUPABASE_DB_URL)
  const toolRepository = createPostgresToolRepository(environment.SUPABASE_DB_URL)
  const tools = new DefaultToolExecutionService(toolRepository)
  const generation = new DeepSeekGenerationProvider(
    environment.DEEPSEEK_MODEL,
    environment.DEEPSEEK_BASE_URL,
    environment.DEEPSEEK_API_KEY,
    environment.DEEPSEEK_TIMEOUT_MS,
  )
  return {
    agentService: new DefaultAgentService(agentRepository, knowledgeService, tools, generation, {
      dailyRequestLimit: environment.DEMO_DAILY_REQUEST_LIMIT,
      dailyTokenLimit: environment.DEMO_DAILY_TOKEN_LIMIT,
    }),
  }
}
