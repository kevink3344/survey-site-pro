import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { formatDate } from '../lib/helpers'
import type { SurveyResultsPayload } from '../types'
import { Card, Mono, Badge } from '../components/ui'

const pieColors = ['hsl(var(--primary))', 'hsl(var(--accent-foreground))', '#f59e0b', '#10b981', '#ef4444']

export function SurveyResultsPage() {
  const { id } = useParams()
  const [tab, setTab] = useState<'summary' | 'individual'>('summary')
  const [data, setData] = useState<SurveyResultsPayload | null>(null)

  useEffect(() => {
    if (!id) return
    api.getSurveyResults(id).then(setData).catch(console.error)
  }, [id])

  if (!data) {
    return <div className="text-sm text-muted-foreground">Loading results...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Survey Results</h1>
          <p className="text-muted-foreground">{data.survey.title}</p>
        </div>
        <Badge className="bg-primary/10 text-primary px-3 py-1.5">
          <Mono className="text-xl leading-none">{data.response_count}</Mono>
          <span className="text-sm ml-2">responses</span>
        </Badge>
      </div>

      <div className="flex gap-2">
        <button className={`tab-btn ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>
          Summary
        </button>
        <button className={`tab-btn ${tab === 'individual' ? 'active' : ''}`} onClick={() => setTab('individual')}>
          Individual
        </button>
      </div>

      {tab === 'summary' && (
        <div className="space-y-4">
          {data.questions.map((question) => (
            <Card key={question.question_id} className="p-4 space-y-4">
              <div>
                <p className="font-medium">{question.question_text}</p>
                <p className="text-xs text-muted-foreground uppercase">{question.question_type.replace('_', ' ')}</p>
              </div>

              {question.question_type === 'text' ? (
                <div className="space-y-2">
                  {question.texts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No text responses yet.</p>
                  )}
                  {question.texts.map((value, index) => (
                    <div key={index} className="border border-border rounded-sm p-2 text-sm">
                      {value}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {question.question_type === 'rating' && (
                    <Card className="p-4 bg-accent">
                      <p className="text-xs uppercase text-muted-foreground">Average Rating</p>
                      <Mono className="text-4xl">{question.rating_average.toFixed(2)}</Mono>
                    </Card>
                  )}

                  <div className="h-64 border border-border rounded-sm p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={question.distribution}>
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-64 border border-border rounded-sm p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={question.distribution} dataKey="count" nameKey="label" outerRadius={90}>
                          {question.distribution.map((entry, index) => (
                            <Cell key={`${entry.label}-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'individual' && (
        <Card>
          <div className="divide-y divide-border">
            {data.individual.map((response) => (
              <div key={response.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{response.respondent_name || 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">
                      {response.respondent_email || 'No email provided'}
                    </p>
                  </div>
                  <Mono className="text-xs text-muted-foreground">{formatDate(response.submitted_at)}</Mono>
                </div>

                <div className="space-y-2">
                  {response.answers.map((answer, index) => (
                    <div key={`${answer.question_id}-${index}`} className="border border-border rounded-sm p-2 text-sm">
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
                        <Mono className="text-xs text-muted-foreground pt-0.5">Q{index + 1}</Mono>
                        <p className="font-medium">{answer.question_text}</p>
                        <span aria-hidden="true" />
                        <p className="text-muted-foreground">
                          {answer.value_text ?? answer.value_number ?? answer.value_array?.join(', ') ?? '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
