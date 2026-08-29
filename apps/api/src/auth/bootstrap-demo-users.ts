import { createClient, type User } from '@supabase/supabase-js'
import postgres from 'postgres'

import {
  DEMO_ADMIN_EMAIL,
  DEMO_AGENT_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_WORKSPACE_ID,
  type Locale,
  type WorkspaceRole,
} from '@grounddesk/shared'

import { env } from '../config/env.js'

interface DemoUserDefinition {
  email: string
  displayName: string
  locale: Locale
  role: WorkspaceRole
}

const demoUsers: readonly DemoUserDefinition[] = [
  {
    email: DEMO_ADMIN_EMAIL,
    displayName: 'GroundDesk Demo Admin',
    locale: 'zh-CN',
    role: 'admin',
  },
  {
    email: DEMO_AGENT_EMAIL,
    displayName: 'GroundDesk Demo Agent',
    locale: 'en-US',
    role: 'agent',
  },
]

if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.SUPABASE_DB_URL) {
  throw new Error('Connected Supabase URL, secret key, and database URL are required.')
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})
const database = postgres(env.SUPABASE_DB_URL, {
  max: 1,
  ssl: 'require',
  connection: { application_name: 'grounddesk-auth-bootstrap' },
})

const findExistingUser = async (email: string): Promise<User | null> => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

const provisionUser = async (definition: DemoUserDefinition): Promise<User> => {
  const existingUser = await findExistingUser(definition.email)

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: DEMO_LOGIN_PASSWORD,
      user_metadata: {
        display_name: definition.displayName,
        locale: definition.locale,
        demo_account: true,
      },
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: definition.email,
    password: DEMO_LOGIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: definition.displayName,
      locale: definition.locale,
      demo_account: true,
    },
  })
  if (error) throw error
  return data.user
}

try {
  const provisionedUsers: Array<{ id: string; email: string; role: WorkspaceRole }> = []

  for (const definition of demoUsers) {
    const user = await provisionUser(definition)

    await database.begin(async (transaction) => {
      await transaction`
        insert into public.profiles (id, display_name, locale)
        values (${user.id}, ${definition.displayName}, ${definition.locale})
        on conflict (id) do update
        set display_name = excluded.display_name,
            locale = excluded.locale
      `
      await transaction`
        insert into public.workspace_members (workspace_id, user_id, role)
        values (${DEMO_WORKSPACE_ID}, ${user.id}, ${definition.role})
        on conflict (workspace_id, user_id) do update
        set role = excluded.role
      `
    })

    provisionedUsers.push({ id: user.id, email: definition.email, role: definition.role })
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        valid: true,
        workspaceId: DEMO_WORKSPACE_ID,
        users: provisionedUsers,
        note: 'Demo accounts use an intentionally public, resettable credential.',
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await database.end({ timeout: 5 })
}
