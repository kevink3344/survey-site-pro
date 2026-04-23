import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Plus } from 'lucide-react'
import { api } from '../lib/api'
import type { Survey } from '../types'
import { Badge, Button, Card, Mono } from '../components/ui'

export function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [message, setMessage] = useState<string>('')
  const navigate = useNavigate()
  const location = useLocation()

  const surveyBaseUrl = useMemo(() => window.location.origin, [])

  const refresh = () => api.listSurveys().then(setSurveys)

  useEffect(() => {
    refresh().catch(console.error)
  }, [])

  useEffect(() => {
    const nextMessage = (location.state as { message?: string } | null)?.message
    if (nextMessage) {
      setMessage(nextMessage)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const onCopyUrl = async (survey: Survey) => {
    const url = `${surveyBaseUrl}/s/${survey.slug}/${survey.access_code}`
    await navigator.clipboard.writeText(url)
    setMessage('Survey URL copied to clipboard.')
  }

  const onPreviewSurvey = (survey: Survey) => {
    navigate(`/s/${survey.slug}/${survey.access_code}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Surveys</h1>
          <p className="text-muted-foreground">Create and manage onboarding and offboarding surveys.</p>
        </div>
        <Button onClick={() => navigate('/surveys/new')} className="w-full sm:w-auto justify-center">
          <Plus className="h-4 w-4" />
          New Survey
        </Button>
      </div>

      {message && (
        <Card className="px-4 py-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>{message}</span>
          <Button variant="ghost" onClick={() => setMessage('')}>
            Dismiss
          </Button>
        </Card>
      )}

      <Card>
        <div className="hidden md:block divide-y divide-border">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="col-span-4">Survey</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Responses</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>

          {surveys.map((survey) => (
            <div key={survey.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm">
              <div className="col-span-4">
                <p className="font-medium">{survey.title}</p>
                <Mono className="text-xs text-muted-foreground">/{survey.slug}/{survey.access_code}</Mono>
              </div>
              <div className="col-span-2">
                <Badge className={survey.type === 'onboarding' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700'}>
                  {survey.type}
                </Badge>
              </div>
              <div className="col-span-2">
                <Badge className={survey.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}>
                  {survey.status}
                </Badge>
              </div>
              <div className="col-span-2">
                <Mono>{survey.response_count ?? 0}</Mono>
              </div>
              <div className="col-span-2 flex justify-end">
                <details className="relative">
                  <summary className="list-none h-8 w-8 grid place-items-center border border-border rounded-sm cursor-pointer">
                    <MoreHorizontal className="h-4 w-4" />
                  </summary>
                  <div className="absolute right-0 mt-1 w-48 border border-border rounded-sm bg-popover z-20 p-1 space-y-1">
                    <button className="menu-item" onClick={() => navigate(`/surveys/${survey.id}/edit`)}>
                      Edit
                    </button>
                    <button
                      className="menu-item"
                      onClick={async () => {
                        await api.toggleSurveyStatus(survey.id)
                        refresh().catch(console.error)
                      }}
                    >
                      {survey.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button className="menu-item" onClick={() => onCopyUrl(survey)}>
                      Copy URL
                    </button>
                    <button className="menu-item" onClick={() => onPreviewSurvey(survey)}>
                      Preview
                    </button>
                    <button className="menu-item" onClick={() => navigate(`/surveys/${survey.id}/results`)}>
                      View Responses
                    </button>
                    <button className="menu-item text-destructive" onClick={() => navigate(`/surveys/${survey.id}/delete`)}>
                      Delete
                    </button>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>

        <div className="md:hidden divide-y divide-border">
          {surveys.map((survey) => (
            <div key={survey.id} className="p-4 space-y-3">
              <div>
                <p className="font-medium">{survey.title}</p>
                <Mono className="text-xs text-muted-foreground break-all">/{survey.slug}/{survey.access_code}</Mono>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={survey.type === 'onboarding' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700'}>
                  {survey.type}
                </Badge>
                <Badge className={survey.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}>
                  {survey.status}
                </Badge>
                <Mono className="ml-auto text-sm">{survey.response_count ?? 0}</Mono>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => navigate(`/surveys/${survey.id}/edit`)}>
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await api.toggleSurveyStatus(survey.id)
                    refresh().catch(console.error)
                  }}
                >
                  {survey.status === 'published' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button variant="secondary" onClick={() => onCopyUrl(survey)}>
                  Copy URL
                </Button>
                <Button variant="secondary" onClick={() => onPreviewSurvey(survey)}>
                  Preview
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/surveys/${survey.id}/results`)}>
                  View Responses
                </Button>
              </div>

              <Button
                variant="secondary"
                className="w-full text-destructive"
                onClick={() => navigate(`/surveys/${survey.id}/delete`)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </Card>

    </div>
  )
}
