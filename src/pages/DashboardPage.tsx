import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckSquare, ClipboardList, FileText, TrendingUp, Users } from 'lucide-react'
import { api } from '../lib/api'
import { getSurveyTypeBadgeClass } from '../lib/helpers'
import type { DashboardPayload } from '../types'
import { Card, Mono, Badge } from '../components/ui'

type StatCardProps = {
  title: string
  value: number
  icon: ComponentType<{ className?: string }>
}

function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{title}</p>
        <span className="rounded-sm bg-accent/60 p-1">
          <Icon className="h-4 w-4 text-primary" />
        </span>
      </div>
      <Mono className="text-4xl mt-6 block">{value}</Mono>
    </Card>
  )
}

function getInsightClass(severity: 'positive' | 'warning' | 'info') {
  if (severity === 'positive') {
    return 'border-emerald-300 bg-emerald-50/60'
  }
  if (severity === 'warning') {
    return 'border-amber-300 bg-amber-50/70'
  }
  return 'border-blue-300 bg-blue-50/60'
}

function getInsightIcon(severity: 'positive' | 'warning' | 'info') {
  if (severity === 'positive') {
    return TrendingUp
  }
  return AlertTriangle
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((err) => {
        console.error(err)
        setError('Unable to load dashboard data. Please check API connectivity and try again.')
      })
  }, [])

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>
  }

  const selectedDateLabel = selectedDateKey
    ? (data.responses_last_14_days.find((d) => d.key === selectedDateKey)?.date ?? selectedDateKey)
    : null

  const barData = selectedDateKey
    ? (data.daily_responses_by_survey[selectedDateKey] ?? [])
    : data.responses_by_survey

  function handleDotClick(_event: unknown, dotData: { payload: { key: string } }) {
    const key = dotData?.payload?.key
    if (!key) return
    setSelectedDateKey((prev) => (prev === key ? null : key))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of survey activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard title="Total Surveys" value={data.stats.total_surveys} icon={FileText} />
        <StatCard title="Published" value={data.stats.published_surveys} icon={CheckSquare} />
        <StatCard title="Onboarding Responses" value={data.stats.onboarding_responses} icon={Users} />
        <StatCard title="Offboarding Responses" value={data.stats.offboarding_responses} icon={TrendingUp} />
        <StatCard title="General Responses" value={data.stats.general_responses} icon={ClipboardList} />
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Anomaly &amp; Trend Highlights</h2>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Auto-generated</span>
        </div>
        <div className="space-y-2">
          {data.insights.map((insight) => {
            const InsightIcon = getInsightIcon(insight.severity)
            return (
              <div
                key={insight.id}
                className={`rounded-sm border p-3 flex items-start justify-between gap-3 ${getInsightClass(insight.severity)}`}
              >
                <div className="flex items-start gap-2">
                  <InsightIcon className="h-4 w-4 mt-0.5 text-foreground/80" />
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {insight.metric && <Mono className="text-xs mt-0.5">{insight.metric}</Mono>}
                  {insight.action && (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded-sm border border-border bg-background hover:bg-accent transition-colors"
                      onClick={() => navigate(insight.action?.to ?? '/dashboard')}
                    >
                      {insight.action.label}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-xl font-semibold mb-4">Responses - Last 14 Days</h2>
          <p className="text-xs text-muted-foreground -mt-3 mb-3">Click a point to filter by day</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.responses_last_14_days}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Line
                  type="natural"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(dotProps) => {
                    const { cx, cy, payload } = dotProps as { cx: number; cy: number; payload: { key: string } }
                    if (payload.key === selectedDateKey) {
                      return <circle key={`dot-${payload.key}`} cx={cx} cy={cy} r={5} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} style={{ cursor: 'pointer' }} />
                    }
                    return <circle key={`dot-${payload.key}`} cx={cx} cy={cy} r={3} fill="hsl(var(--primary))" opacity={0.5} style={{ cursor: 'pointer' }} />
                  }}
                  activeDot={{ r: 6, cursor: 'pointer', onClick: handleDotClick } as object}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">
                Responses by Survey
                {selectedDateLabel && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">— {selectedDateLabel}</span>
                )}
              </h2>
            </div>
            {selectedDateKey && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSelectedDateKey(null)}
              >
                Clear filter
              </button>
            )}
          </div>
          {selectedDateKey && barData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              No responses on {selectedDateLabel}
            </div>
          ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="title" type="category" width={160} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="responses" fill="hsl(var(--primary))" radius={[2, 2, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Surveys</h2>
          <a href="/surveys" className="text-sm text-primary">
            View all
          </a>
        </div>
        <div className="divide-y divide-border">
          {data.recent_surveys.map((survey) => (
            <div key={survey.id} className="px-5 py-3 flex flex-col items-start md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                {survey.cover_image_url && (
                  <img
                    src={survey.cover_image_url}
                    alt={survey.cover_image_alt || `${survey.title} cover photo`}
                    className="h-10 w-16 rounded-sm border border-border object-cover"
                  />
                )}
                <Badge className={getSurveyTypeBadgeClass(survey.type)}>
                  {survey.type}
                </Badge>
                <span>{survey.title}</span>
              </div>
              <div className="flex items-center gap-4 text-sm w-full md:w-auto justify-between md:justify-end">
                <Mono className="text-muted-foreground">{survey.response_count ?? 0} responses</Mono>
                <Badge className={survey.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}>
                  {survey.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
