import type { OverviewMetrics } from '@grounddesk/shared'

export interface AnalyticsRepository {
  overview(workspaceId: string, periodDays: number): Promise<OverviewMetrics>
  close(): Promise<void>
}
