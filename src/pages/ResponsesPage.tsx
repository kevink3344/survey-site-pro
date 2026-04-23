import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/helpers'
import type { Survey, SurveyResponse } from '../types'
import { Badge, Card, Input, Mono, Select } from '../components/ui'

export function ResponsesPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [surveyId, setSurveyId] = useState('all')

  useEffect(() => {
    api.listSurveys().then(setSurveys).catch(console.error)
  }, [])

  useEffect(() => {
    api.listResponses({ search, type, surveyId }).then(setResponses).catch(console.error)
  }, [search, type, surveyId])

  const filteredCount = useMemo(() => responses.length, [responses])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Responses</h1>
        <p className="text-muted-foreground">All survey responses across onboarding and offboarding workflows.</p>
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
        <div className="hidden md:block divide-y divide-border">
          {responses.map((response) => (
            <div key={response.id} className="px-4 py-3 grid grid-cols-12 items-center gap-3 text-sm">
              <div className="col-span-3">
                <p className="font-medium">{response.respondent_name || 'Anonymous'}</p>
                <p className="text-muted-foreground">{response.respondent_email || 'No email provided'}</p>
              </div>
              <div className="col-span-3">
                <p>{response.survey_title}</p>
                <Badge className={response.survey_type === 'onboarding' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700'}>
                  {response.survey_type}
                </Badge>
              </div>
              <div className="col-span-3">
                <Mono className="text-xs text-muted-foreground">{formatDate(response.submitted_at)}</Mono>
              </div>
              <div className="col-span-3 text-right">
                <Link className="text-primary" to={`/surveys/${response.survey_id}/results`}>
                  View Survey Results
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="md:hidden divide-y divide-border">
          {responses.map((response) => (
            <div key={response.id} className="px-4 py-3 space-y-3 text-sm">
              <div>
                <p className="font-medium">{response.respondent_name || 'Anonymous'}</p>
                <p className="text-muted-foreground break-all">{response.respondent_email || 'No email provided'}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={response.survey_type === 'onboarding' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700'}>
                  {response.survey_type}
                </Badge>
                <span className="text-muted-foreground truncate">{response.survey_title}</span>
              </div>

              <Mono className="text-xs text-muted-foreground block">{formatDate(response.submitted_at)}</Mono>

              <Link className="text-primary text-sm" to={`/surveys/${response.survey_id}/results`}>
                View Survey Results
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
