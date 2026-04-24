import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, CheckSquare, Users, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
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

export function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)

  useEffect(() => {
    api.getDashboard().then(setData).catch(console.error)
  }, [])

  if (!data) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of survey activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Surveys" value={data.stats.total_surveys} icon={FileText} />
        <StatCard title="Published" value={data.stats.published_surveys} icon={CheckSquare} />
        <StatCard title="Onboarding Responses" value={data.stats.onboarding_responses} icon={Users} />
        <StatCard title="Offboarding Responses" value={data.stats.offboarding_responses} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-xl font-semibold mb-4">Responses - Last 14 Days</h2>
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
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-semibold mb-4">Responses by Survey</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.responses_by_survey} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="title" type="category" width={160} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="responses" fill="hsl(var(--primary))" radius={[2, 2, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                <Badge className={survey.type === 'onboarding' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}>
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
