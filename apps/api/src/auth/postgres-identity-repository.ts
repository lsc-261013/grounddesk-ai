import type { Sql } from 'postgres'

import { localeSchema, workspaceRoleSchema, type WorkspaceMembership } from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import type { IdentityProfile, IdentityRepository } from './types.js'

interface ProfileRow {
  id: string
  displayName: string
  avatarUrl: string | null
  locale: string
}

interface MembershipRow {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  isDemo: boolean
  role: string
}

const mapMembership = (row: MembershipRow): WorkspaceMembership => ({
  workspace: {
    id: row.workspaceId,
    name: row.workspaceName,
    slug: row.workspaceSlug,
    isDemo: row.isDemo,
  },
  role: workspaceRoleSchema.parse(row.role),
})

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly database: Sql) {}

  async getProfile(userId: string): Promise<IdentityProfile | null> {
    const rows = await this.database<ProfileRow[]>`
      select
        id,
        display_name as "displayName",
        avatar_url as "avatarUrl",
        locale
      from public.profiles
      where id = ${userId}
      limit 1
    `
    const row = rows[0]

    return row
      ? {
          id: row.id,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          locale: localeSchema.parse(row.locale),
        }
      : null
  }

  async listMemberships(userId: string): Promise<WorkspaceMembership[]> {
    const rows = await this.database<MembershipRow[]>`
      select
        workspace.id as "workspaceId",
        workspace.name as "workspaceName",
        workspace.slug as "workspaceSlug",
        workspace.is_demo as "isDemo",
        membership.role::text as role
      from public.workspace_members membership
      join public.workspaces workspace on workspace.id = membership.workspace_id
      where membership.user_id = ${userId}
      order by workspace.name, workspace.id
    `

    return rows.map(mapMembership)
  }

  async getMembership(userId: string, workspaceId: string): Promise<WorkspaceMembership | null> {
    const rows = await this.database<MembershipRow[]>`
      select
        workspace.id as "workspaceId",
        workspace.name as "workspaceName",
        workspace.slug as "workspaceSlug",
        workspace.is_demo as "isDemo",
        membership.role::text as role
      from public.workspace_members membership
      join public.workspaces workspace on workspace.id = membership.workspace_id
      where membership.user_id = ${userId}
        and membership.workspace_id = ${workspaceId}
      limit 1
    `

    return rows[0] ? mapMembership(rows[0]) : null
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresIdentityRepository = (source: DatabaseSource): IdentityRepository =>
  new PostgresIdentityRepository(
    createRepositoryDatabase(source, {
      max: 5,
      applicationName: 'grounddesk-api',
    }),
  )
