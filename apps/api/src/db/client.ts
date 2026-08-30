import postgres, { type Sql } from 'postgres'

export type DatabaseSource = string | Sql

interface DatabaseClientOptions {
  applicationName: string
  max?: number
}

const sharedDatabases = new WeakSet<Sql>()

export const createDatabaseClient = (
  databaseUrl: string,
  options: DatabaseClientOptions = { applicationName: 'grounddesk-api' },
): Sql =>
  postgres(databaseUrl, {
    max: options.max ?? 8,
    ssl: 'require',
    prepare: false,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connection: { application_name: options.applicationName },
  })

export const createRepositoryDatabase = (
  source: DatabaseSource,
  options: DatabaseClientOptions,
): Sql => {
  if (typeof source === 'string') return createDatabaseClient(source, options)
  sharedDatabases.add(source)
  return source
}

export const closeRepositoryDatabase = async (database: Sql): Promise<void> => {
  if (!sharedDatabases.has(database)) await database.end({ timeout: 5 })
}
