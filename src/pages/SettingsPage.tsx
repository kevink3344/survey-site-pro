import { ExternalLink } from 'lucide-react'
import { Card } from '../components/ui'

export function SettingsPage() {
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
          href="http://localhost:8787/api/docs"
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
    </div>
  )
}
