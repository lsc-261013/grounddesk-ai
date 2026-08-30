import type { ApiEnv } from '../config/env.js'
import { createPostgresWorkspaceRepository } from './postgres-workspace-repository.js'
import type { WorkspaceRepository } from './repository.js'

class UnavailableWorkspaceRepository implements WorkspaceRepository {
  getSettings(): Promise<null> {
    return Promise.resolve(null)
  }
  updateSettings(): Promise<null> {
    return Promise.resolve(null)
  }
  listMembers(): Promise<never[]> {
    return Promise.resolve([])
  }
  addMember(): Promise<null> {
    return Promise.resolve(null)
  }
  updateMember(): Promise<null> {
    return Promise.resolve(null)
  }
  removeMember(): Promise<boolean> {
    return Promise.resolve(false)
  }
  onboard(): Promise<null> {
    return Promise.resolve(null)
  }
  resetDemo(): Promise<boolean> {
    return Promise.resolve(false)
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

export interface WorkspaceDependencies {
  workspaceRepository: WorkspaceRepository
}

export const createWorkspaceDependencies = (environment: ApiEnv): WorkspaceDependencies => ({
  workspaceRepository:
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createPostgresWorkspaceRepository(environment.SUPABASE_DB_URL)
      : new UnavailableWorkspaceRepository(),
})
