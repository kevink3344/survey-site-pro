import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { formatDate } from '../lib/helpers'
import type { SurveyResultsPayload } from '../types'
import { Card, Mono, Badge } from '../components/ui'

const pieColors = ['hsl(var(--primary))', 'hsl(var(--accent-foreground))', '#f59e0b', '#10b981', '#ef4444']

function getRatingBadgeClass(value: number) {
  if (value <= 2) return 'bg-red-100 text-red-700'
  if (value === 3) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function getRatingBarColor(value: number) {
  if (value <= 2) return '#f87171'
  if (value === 3) return '#fbbf24'
  return '#34d399'
}

function formatEntryLabel(value: string, count: number) {
  return `${value} - ${count} ${count === 1 ? 'entry' : 'entries'}`
}

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
          <span className="hidden text-sm ml-2 sm:inline">responses</span>
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

              {(question.question_type === 'text' || question.question_type === 'multi_text') ? (
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        {question.distribution.map((entry) => {
                          const rating = Number(entry.label)
                          return (
                            <Badge key={`rating-badge-${entry.label}`} className={getRatingBadgeClass(rating)}>
                              <span className="text-xs">{formatEntryLabel(entry.label, entry.count)}</span>
                            </Badge>
                          )
                        })}
                      </div>
                    </Card>
                  )}

                  <div className="h-64 border border-border rounded-sm p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={question.distribution}>
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]}>
                          {question.question_type === 'rating' &&
                            question.distribution.map((entry) => (
                              <Cell
                                key={`rating-bar-${entry.label}`}
                                fill={getRatingBarColor(Number(entry.label))}
                              />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="border border-border rounded-sm p-2 space-y-2">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={question.distribution} dataKey="count" nameKey="label" outerRadius={72}>
                            {question.distribution.map((entry, index) => (
                              <Cell key={`${entry.label}-${index}`} fill={pieColors[index % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 px-1 pb-1">
                      {question.distribution.map((entry, index) => (
                        <span
                          key={`pie-legend-${entry.label}-${index}`}
                          className="inline-flex items-center gap-2 rounded-sm border border-border px-2 py-1 text-xs"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: pieColors[index % pieColors.length] }}
                          />
                          <span>{formatEntryLabel(entry.label, entry.count)}</span>
                        </span>
                      ))}
                    </div>
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{response.respondent_name || 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">
                      {response.respondent_email || 'No email provided'}
                    </p>
                  </div>
                  <Mono className="text-xs text-muted-foreground sm:text-right">{formatDate(response.submitted_at)}</Mono>
                </div>

                <div className="space-y-2">
                  {response.answers.map((answer, index) => (
                    <div key={`${answer.question_id}-${index}`} className="border border-border rounded-sm p-2 text-sm">
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
                        <Mono className="text-xs text-muted-foreground pt-0.5">Q{index + 1}</Mono>
                        <p className="font-medium">{answer.question_text}</p>
                        <span aria-hidden="true" />
                        {answer.question_type === 'rating' && typeof answer.value_number === 'number' ? (
                          <div>
                            <Badge className={getRatingBadgeClass(answer.value_number)}>
                              <span className="text-xs">{answer.value_number}</span>
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            {answer.value_text ?? answer.value_number ?? answer.value_array?.join(', ') ?? '-'}
                          </p>
                        )}
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
