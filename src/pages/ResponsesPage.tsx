import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate, getSurveyTypeBadgeClass } from '../lib/helpers'
import type { Survey, SurveyResponse } from '../types'
import { Badge, Card, Input, Mono, Select } from '../components/ui'

type SurveyResponseGroup = {
  survey_id: string
  survey_title: string
  survey_type: SurveyResponse['survey_type']
  responses: SurveyResponse[]
}

export function ResponsesPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [surveyId, setSurveyId] = useState('all')
  const [expandedBySurvey, setExpandedBySurvey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.listSurveys().then(setSurveys).catch(console.error)
  }, [])

  useEffect(() => {
    api.listResponses({ search, type, surveyId }).then(setResponses).catch(console.error)
  }, [search, type, surveyId])

  const filteredCount = useMemo(() => responses.length, [responses])

  const groupedResponses = useMemo(() => {
    const bySurvey = new Map<string, SurveyResponseGroup>()

    for (const response of responses) {
      const existing = bySurvey.get(response.survey_id)
      if (existing) {
        existing.responses.push(response)
        continue
      }

      bySurvey.set(response.survey_id, {
        survey_id: response.survey_id,
        survey_title: response.survey_title,
        survey_type: response.survey_type,
        responses: [response],
      })
    }

    return Array.from(bySurvey.values())
  }, [responses])

  useEffect(() => {
    setExpandedBySurvey((previous) => {
      const next: Record<string, boolean> = {}
      for (const group of groupedResponses) {
        next[group.survey_id] = previous[group.survey_id] ?? false
      }
      return next
    })
  }, [groupedResponses])

  const toggleSurveySection = (id: string) => {
    setExpandedBySurvey((previous) => ({
      ...previous,
      [id]: !(previous[id] ?? false),
    }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Responses</h1>
        <p className="text-muted-foreground">All survey responses across onboarding, offboarding, and general workflows.</p>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          placeholder="Filter by respondent name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">All types</option>
          <option value="onboarding">Onboarding</option>
          <option value="offboarding">Offboarding</option>
          <option value="general">General</option>
        </Select>
        <Select value={surveyId} onChange={(event) => setSurveyId(event.target.value)}>
          <option value="all">All surveys</option>
          {surveys.map((survey) => (
            <option key={survey.id} value={survey.id}>
              {survey.title}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Showing</span>
          <Mono>{filteredCount}</Mono>
        </div>

        <div className="divide-y divide-border">
          {groupedResponses.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground">No responses found for the current filters.</div>
          )}

          {groupedResponses.map((group) => {
            const isExpanded = expandedBySurvey[group.survey_id] ?? false
            return (
              <section key={group.survey_id}>
                <button
                  type="button"
                  onClick={() => toggleSurveySection(group.survey_id)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={getSurveyTypeBadgeClass(group.survey_type)}>{group.survey_type}</Badge>
                    <span className="font-medium truncate text-left">{group.survey_title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Mono className="text-xs text-muted-foreground">{group.responses.length}</Mono>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="hidden md:block divide-y divide-border">
                      {group.responses.map((response) => (
                        <div key={response.id} className="px-4 py-3 grid grid-cols-12 items-center gap-3 text-sm">
                          <div className="col-span-4">
                            <p className="font-medium">{response.respondent_name || 'Anonymous'}</p>
                            <p className="text-muted-foreground">{response.respondent_email || 'No email provided'}</p>
                          </div>
                          <div className="col-span-4">
                            <Mono className="text-xs text-muted-foreground">{formatDate(response.submitted_at)}</Mono>
                          </div>
                          <div className="col-span-4 text-right">
                            <Link className="text-primary" to={`/surveys/${response.survey_id}/results`}>
                              View Survey Results
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="md:hidden divide-y divide-border">
                      {group.responses.map((response) => (
                        <div key={response.id} className="px-4 py-3 space-y-3 text-sm">
                          <div>
                            <p className="font-medium">{response.respondent_name || 'Anonymous'}</p>
                            <p className="text-muted-foreground break-all">{response.respondent_email || 'No email provided'}</p>
                          </div>

                          <Mono className="text-xs text-muted-foreground block">{formatDate(response.submitted_at)}</Mono>

                          <Link className="text-primary text-sm" to={`/surveys/${response.survey_id}/results`}>
                            View Survey Results
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
