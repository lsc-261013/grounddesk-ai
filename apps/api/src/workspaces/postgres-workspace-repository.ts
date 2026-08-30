import type { JSONValue, Sql } from 'postgres'

import {
  workspaceMemberSchema,
  workspaceMembershipSchema,
  workspaceSettingsSchema,
  type Locale,
  type WorkspaceMember,
  type WorkspaceMembership,
  type WorkspaceRole,
  type WorkspaceSettings,
} from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import { DEMO_PRODUCT_BASELINE } from './demo-products.js'
import type { WorkspaceRepository } from './repository.js'

const asJsonValue = (value: Record<string, unknown>): JSONValue =>
  JSON.parse(JSON.stringify(value)) as JSONValue

interface SettingsRow {
  id: string
  name: string
  slug: string
  defaultLocale: string
  confidenceThreshold: number
  isDemo: boolean
  updatedAt: Date
}

interface MemberRow {
  userId: string
  email: string | null
  displayName: string
  role: string
  createdAt: Date
}

const mapSettings = (row: SettingsRow): WorkspaceSettings =>
  workspaceSettingsSchema.parse({ ...row, updatedAt: row.updatedAt.toISOString() })

const mapMember = (row: MemberRow): WorkspaceMember =>
  workspaceMemberSchema.parse({ ...row, createdAt: row.createdAt.toISOString() })

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly database: Sql) {}

  async getSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
    const rows = await this.database<SettingsRow[]>`
      select id, name, slug, default_locale as "defaultLocale",
        confidence_threshold::double precision as "confidenceThreshold",
        is_demo as "isDemo", updated_at as "updatedAt"
      from public.workspaces where id = ${workspaceId} limit 1
    `
    return rows[0] ? mapSettings(rows[0]) : null
  }

  async updateSettings(
    workspaceId: string,
    input: { name: string; defaultLocale: Locale; confidenceThreshold: number },
  ): Promise<WorkspaceSettings | null> {
    await this.database`
      update public.workspaces set name = ${input.name}, default_locale = ${input.defaultLocale},
        confidence_threshold = ${input.confidenceThreshold}, updated_at = now()
      where id = ${workspaceId}
    `
    return this.getSettings(workspaceId)
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const rows = await this.database<MemberRow[]>`
      select member.user_id as "userId", auth_user.email, profile.display_name as "displayName",
        member.role::text, member.created_at as "createdAt"
      from public.workspace_members member
      join public.profiles profile on profile.id = member.user_id
      left join auth.users auth_user on auth_user.id = member.user_id
      where member.workspace_id = ${workspaceId}
      order by case member.role when 'admin' then 1 else 2 end, profile.display_name, member.user_id
    `
    return rows.map(mapMember)
  }

  private async member(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const rows = await this.database<MemberRow[]>`
      select member.user_id as "userId", auth_user.email, profile.display_name as "displayName",
        member.role::text, member.created_at as "createdAt"
      from public.workspace_members member
      join public.profiles profile on profile.id = member.user_id
      left join auth.users auth_user on auth_user.id = member.user_id
      where member.workspace_id = ${workspaceId} and member.user_id = ${userId}
      limit 1
    `
    return rows[0] ? mapMember(rows[0]) : null
  }

  async addMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember | null> {
    const users = await this.database<{ id: string }[]>`
      select id from auth.users where lower(email) = lower(${email}) limit 1
    `
    const userId = users[0]?.id
    if (!userId) return null
    await this.database`
      insert into public.workspace_members (workspace_id, user_id, role)
      values (${workspaceId}, ${userId}, ${role})
      on conflict (workspace_id, user_id) do update set role = excluded.role, updated_at = now()
    `
    return this.member(workspaceId, userId)
  }

  async updateMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember | null> {
    const current = await this.member(workspaceId, userId)
    if (!current) return null
    if (current.role === 'admin' && role !== 'admin') {
      const counts = await this.database<{ total: number }[]>`
        select count(*)::integer as total from public.workspace_members
        where workspace_id = ${workspaceId} and role = 'admin'
      `
      if ((counts[0]?.total ?? 0) <= 1) return null
    }
    await this.database`
      update public.workspace_members set role = ${role}, updated_at = now()
      where workspace_id = ${workspaceId} and user_id = ${userId}
    `
    return this.member(workspaceId, userId)
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const current = await this.member(workspaceId, userId)
    if (!current) return false
    if (current.role === 'admin') {
      const counts = await this.database<{ total: number }[]>`
        select count(*)::integer as total from public.workspace_members
        where workspace_id = ${workspaceId} and role = 'admin'
      `
      if ((counts[0]?.total ?? 0) <= 1) return false
    }
    const rows = await this.database<{ userId: string }[]>`
      delete from public.workspace_members
      where workspace_id = ${workspaceId} and user_id = ${userId}
      returning user_id as "userId"
    `
    return rows.length === 1
  }

  async onboard(
    userId: string,
    input: { name: string; slug: string; defaultLocale: Locale },
  ): Promise<WorkspaceMembership | null> {
    try {
      return await this.database.begin(async (transaction) => {
        // Locking the auth user serializes concurrent onboarding attempts for one account.
        await transaction`select id from auth.users where id = ${userId} for update`
        const existing = await transaction<{ id: string }[]>`
          select workspace_id as id from public.workspace_members where user_id = ${userId} limit 1
        `
        if (existing.length > 0) return null
        const rows = await transaction<{ id: string }[]>`
          insert into public.workspaces (name, slug, default_locale, confidence_threshold, is_demo)
          values (${input.name}, ${input.slug}, ${input.defaultLocale}, 0.62, false)
          returning id
        `
        const workspaceId = rows[0]?.id
        if (!workspaceId) return null
        await transaction`
          insert into public.workspace_members (workspace_id, user_id, role)
          values (${workspaceId}, ${userId}, 'admin')
        `
        return workspaceMembershipSchema.parse({
          workspace: { id: workspaceId, name: input.name, slug: input.slug, isDemo: false },
          role: 'admin',
        })
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return null
      }
      throw error
    }
  }

  async resetDemo(workspaceId: string): Promise<boolean> {
    const workspaces = await this.database<{ isDemo: boolean }[]>`
      select is_demo as "isDemo" from public.workspaces where id = ${workspaceId} limit 1
    `
    if (!workspaces[0]?.isDemo) return false
    await this.database.begin(async (transaction) => {
      await transaction`delete from public.webhook_deliveries where workspace_id = ${workspaceId}`
      await transaction`delete from public.webhook_endpoints where workspace_id = ${workspaceId}`
      await transaction`delete from public.eval_runs where workspace_id = ${workspaceId}`
      await transaction`delete from public.daily_demo_usage where workspace_id = ${workspaceId}`
      await transaction`delete from public.ai_usage_events where workspace_id = ${workspaceId}`
      await transaction`delete from public.audit_logs where workspace_id = ${workspaceId}`
      await transaction`delete from public.conversations where workspace_id = ${workspaceId}`
      for (const product of DEMO_PRODUCT_BASELINE) {
        await transaction`
          insert into public.products (
            id, workspace_id, sku, model, category, name_zh, name_en, description_zh,
            description_en, price_cents, currency, specs, is_returnable,
            opened_return_policy, is_active
          ) values (
            ${product.id}, ${workspaceId}, ${product.sku}, ${product.model}, ${product.category},
            ${product.nameZh}, ${product.nameEn}, ${product.descriptionZh},
            ${product.descriptionEn}, ${product.priceCents}, ${product.currency},
            ${transaction.json(asJsonValue(product.specs))}, ${product.isReturnable},
            ${product.openedReturnPolicy}, true
          )
          on conflict (id) do update set sku = excluded.sku, model = excluded.model,
            category = excluded.category, name_zh = excluded.name_zh, name_en = excluded.name_en,
            description_zh = excluded.description_zh,
            description_en = excluded.description_en, price_cents = excluded.price_cents,
            currency = excluded.currency, specs = excluded.specs,
            is_returnable = excluded.is_returnable,
            opened_return_policy = excluded.opened_return_policy, is_active = true,
            updated_at = now()
        `
      }
      const baselineIds = DEMO_PRODUCT_BASELINE.map((product) => product.id)
      await transaction`
        delete from public.products product
        where product.workspace_id = ${workspaceId}
          and product.id not in ${transaction(baselineIds)}
          and not exists (
            select 1 from public.order_items item where item.product_id = product.id
          )
      `
      await transaction`
        with generated as (
          select series as order_index,
            case when series between 1 and 5 then 'pending'::public.order_status
              when series between 6 and 10 then 'processing'::public.order_status
              when series between 11 and 17 then 'shipped'::public.order_status
              when series between 18 and 26 then 'delivered'::public.order_status
              else 'cancelled'::public.order_status end as status,
            case when series between 18 and 22 then current_date - ((series - 17) + 4)
              when series between 23 and 26 then current_date - ((35 + series) + 4)
              else current_date - greatest(1, series % 12) end as order_day
          from generate_series(1, 30) series
        )
        update public.orders order_record set status = generated.status,
          ordered_at = generated.order_day + time '09:30',
          shipped_at = case when generated.status in ('shipped', 'delivered')
            then generated.order_day + interval '1 day 7 hours' end,
          delivered_at = case when generated.status = 'delivered'
            then generated.order_day + interval '4 days 6 hours' end,
          cancelled_at = case when generated.status = 'cancelled'
            then generated.order_day + interval '5 hours' end,
          updated_at = now()
        from generated
        where order_record.workspace_id = ${workspaceId}
          and order_record.order_number = format('GD-2026D%s', lpad(generated.order_index::text, 3, '0'))
      `
      await transaction`
        update public.workspaces set name = 'Avenlo Demo Workspace', default_locale = 'zh-CN',
          confidence_threshold = 0.60, updated_at = now() where id = ${workspaceId}
      `
    })
    return true
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresWorkspaceRepository = (source: DatabaseSource): WorkspaceRepository =>
  new PostgresWorkspaceRepository(
    createRepositoryDatabase(source, {
      max: 4,
      applicationName: 'grounddesk-workspaces',
    }),
  )
