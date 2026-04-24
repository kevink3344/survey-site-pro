import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { api, getApiUrl } from '../lib/api'
import type { SeedSummary } from '../types'
import { Button, Card, Mono } from '../components/ui'

export function SettingsPage() {
  const [seedAction, setSeedAction] = useState<'all' | 'responses' | null>(null)
  const [seedSummary, setSeedSummary] = useState<SeedSummary | null>(null)
  const [seedError, setSeedError] = useState('')

  const runSeedAll = async () => {
    setSeedAction('all')
    setSeedError('')
    try {
      const result = await api.seedDemoData()
      setSeedSummary(result)
    } catch {
      setSeedError('Unable to seed data right now. Please verify the API server is reachable and try again.')
    } finally {
      setSeedAction(null)
    }
  }

  const runSeedResponsesOnly = async () => {
    setSeedAction('responses')
    setSeedError('')
    try {
      const result = await api.seedRecentResponsesOnly()
      setSeedSummary(result)
    } catch {
      setSeedError('Unable to seed responses right now. Please verify the API server is reachable and try again.')
    } finally {
      setSeedAction(null)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Administrator tools and configuration links.</p>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">API docs</h2>
        <p className="text-sm text-muted-foreground">
          Open the Swagger UI documentation for all survey management endpoints.
        </p>
        <a
          href={getApiUrl('/api/docs')}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-primary text-sm"
        >
          Open Swagger UI
          <ExternalLink className="h-4 w-4" />
        </a>
      </Card>

      <Card className="p-5 space-y-2">
        <h2 className="text-xl font-semibold">Header Controls</h2>
        <p className="text-sm text-muted-foreground">
          Use the top-right icon actions for settings, light or dark mode, and user profile details.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">Demo Data</h2>
        <p className="text-sm text-muted-foreground">
          Add sample surveys and respondent users, including responses distributed over the last 14 days.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runSeedAll} disabled={seedAction !== null}>
            {seedAction === 'all' ? 'Seeding...' : 'Seed Surveys and Users'}
          </Button>
          <Button onClick={runSeedResponsesOnly} disabled={seedAction !== null} variant="secondary">
            {seedAction === 'responses' ? 'Seeding...' : 'Seed Responses Only'}
          </Button>
        </div>
        {seedSummary && (
          <p className="text-sm text-foreground">
            Seeded <Mono>{seedSummary.created_surveys}</Mono> surveys, <Mono>{seedSummary.created_users}</Mono>{' '}
            users, and <Mono>{seedSummary.created_responses}</Mono> responses.
          </p>
        )}
        {seedError && <p className="text-sm text-destructive">{seedError}</p>}
      </Card>
    </div>
  )
}
