import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Survey } from '../types'
import { Button, Card, Input, Mono } from '../components/ui'

export function SurveyDeletePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Survey not found.')
      return
    }

    api
      .getSurvey(id)
      .then(setSurvey)
      .catch(() => setError('Survey not found.'))
      .finally(() => setLoading(false))
  }, [id])

  const canDelete = confirmText.trim().toLowerCase() === 'delete'

  const onDelete = async () => {
    if (!id || !canDelete) {
      return
    }

    setDeleting(true)
    try {
      await api.deleteSurvey(id)
      navigate('/surveys', {
        replace: true,
        state: { message: 'Survey deleted.' },
      })
    } catch {
      setError('Unable to delete survey.')
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading survey...</div>
  }

  if (error || !survey) {
    return (
      <Card className="p-5 space-y-3 max-w-2xl">
        <h1 className="text-2xl font-semibold">Delete Survey</h1>
        <p className="text-sm text-destructive">{error || 'Survey not found.'}</p>
        <div>
          <Link className="text-primary text-sm" to="/surveys">
            Back to Surveys
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Delete Survey</h1>
        <p className="text-muted-foreground">This action permanently removes the survey and all of its responses.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <p className="text-base font-medium">Are you sure you want to delete this survey?</p>
          <p className="text-sm text-muted-foreground mt-1">You must type <Mono>delete</Mono> to confirm.</p>
        </div>

        <div className="space-y-2 border border-border rounded-sm p-4 bg-accent/30">
          <p className="font-medium">{survey.title}</p>
          <p className="text-sm text-muted-foreground">{survey.description}</p>
          <Mono className="text-xs text-muted-foreground block">/{survey.slug}/{survey.access_code}</Mono>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase text-muted-foreground">Type delete to confirm</label>
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="delete" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => navigate('/surveys')}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground"
            disabled={!canDelete || deleting}
            onClick={onDelete}
          >
            {deleting ? 'Deleting...' : 'Delete Survey'}
          </Button>
        </div>
      </Card>
    </div>
  )
}