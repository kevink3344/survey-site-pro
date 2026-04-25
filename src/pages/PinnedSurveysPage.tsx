import { useEffect, useMemo, useState } from 'react'
import { Pin, PinOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getSurveyTypeBadgeClass } from '../lib/helpers'
import { getPinnedSurveyIds, togglePinnedSurveyId } from '../lib/pinnedSurveys'
import type { Survey } from '../types'
import { Badge, Button, Card, Mono } from '../components/ui'

export function PinnedSurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => getPinnedSurveyIds())
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.listSurveys().then(setSurveys).catch(console.error)
  }, [])

  const pinnedSurveys = useMemo(
    () =>
      pinnedIds
        .map((id) => surveys.find((survey) => survey.id === id))
        .filter((survey): survey is Survey => Boolean(survey)),
    [pinnedIds, surveys]
  )

  const onTogglePinned = (survey: Survey) => {
    const pinned = togglePinnedSurveyId(survey.id)
    setPinnedIds(getPinnedSurveyIds())
    setMessage(pinned ? `${survey.title} was pinned.` : `${survey.title} was removed from pinned surveys.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Pinned Surveys</h1>
        <p className="text-muted-foreground">Your quick-access list of favorite surveys.</p>
      </div>

      {message && (
        <Card className="px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{message}</span>
          <Button variant="ghost" onClick={() => setMessage('')}>
            Dismiss
          </Button>
        </Card>
      )}

      {pinnedSurveys.length === 0 ? (
        <Card className="p-5 space-y-3">
          <p className="font-medium">No pinned surveys yet.</p>
          <p className="text-sm text-muted-foreground">
            Go to Surveys and pin the items you use most often.
          </p>
          <Button variant="secondary" onClick={() => navigate('/surveys')}>
            Open Surveys
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {pinnedSurveys.map((survey) => (
              <div key={survey.id} className="px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-primary" />
                    <p className="font-medium">{survey.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge className={getSurveyTypeBadgeClass(survey.type)}>
                      {survey.type}
                    </Badge>
                    <Badge className={survey.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}>
                      {survey.status}
                    </Badge>
                    <Mono className="text-xs text-muted-foreground">/{survey.slug}/{survey.access_code}</Mono>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => navigate(`/surveys/${survey.id}/edit`)}>
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => navigate(`/surveys/${survey.id}/results`)}>
                    Results
                  </Button>
                  <Button variant="secondary" onClick={() => onTogglePinned(survey)}>
                    <PinOff className="h-4 w-4" />
                    Unpin
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
