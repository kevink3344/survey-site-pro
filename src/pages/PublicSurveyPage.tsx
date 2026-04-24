import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Survey, SurveyAnswer, SurveyQuestion } from '../types'
import { Button, Card, Input, Textarea, Mono } from '../components/ui'

type Stage = 'intro' | 'questions' | 'review' | 'submitted'

export function PublicSurveyPage() {
  const { slug = '', code = '' } = useParams()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [missingRequired, setMissingRequired] = useState<Record<string, boolean>>({})

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({})
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    api
      .getPublicSurvey(slug, code)
      .then((nextSurvey) => {
        setSurvey(nextSurvey)
        if (nextSurvey.identity_mode === 'hidden') {
          setStage('questions')
        }
      })
      .catch(() =>
        setError('This survey is not available yet. It may be unpublished or the link may be invalid.')
      )
      .finally(() => setLoading(false))
  }, [slug, code])

  const pages = useMemo(() => survey?.pages.sort((a, b) => a.order - b.order) ?? [], [survey])
  const currentPage = pages[pageIndex]
  const questions = useMemo(
    () =>
      (survey?.questions ?? [])
        .filter((q) => q.page_id === currentPage?.id)
        .sort((a, b) => a.order - b.order),
    [survey, currentPage]
  )

  const progress = pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 0

  const isQuestionAnswered = (question: SurveyQuestion) => {
    const value = answers[question.id]
    if (value === undefined || value === null) {
      return false
    }

    if (question.type === 'multiple_choice') {
      return Array.isArray(value) && value.length > 0
    }

    if (question.type === 'rating') {
      return typeof value === 'number'
    }

    const normalized = String(value).trim()
    return normalized.length > 0
  }

  const setAnswer = (question: SurveyQuestion, value: string | number | string[]) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
    setMissingRequired((prev) => {
      if (!prev[question.id]) return prev
      const next = { ...prev }
      delete next[question.id]
      return next
    })
  }

  const normalizeValue = (value: string | number) => String(value).trim().toLowerCase()

  const getNextPageIndex = () => {
    if (!survey || !currentPage) {
      return Math.min(pages.length - 1, pageIndex + 1)
    }

    for (const question of questions) {
      const answer = answers[question.id]
      if (answer === undefined || answer === null) continue

      const answerValues = Array.isArray(answer)
        ? answer.map((item) => normalizeValue(item))
        : [normalizeValue(answer)]

      const matchedRule = (question.branching ?? []).find((rule) =>
        answerValues.includes(normalizeValue(rule.value))
      )

      if (!matchedRule) continue

      const targetPageIndex = pages.findIndex((page) => page.id === matchedRule.goToPageId)
      if (targetPageIndex > pageIndex) {
        return targetPageIndex
      }

      const targetQuestion = survey.questions.find((item) => item.id === matchedRule.goToPageId)
      if (targetQuestion) {
        const targetQuestionPageIndex = pages.findIndex((page) => page.id === targetQuestion.page_id)
        if (targetQuestionPageIndex > pageIndex) {
          return targetQuestionPageIndex
        }
      }
    }

    return Math.min(pages.length - 1, pageIndex + 1)
  }

  const toAnswerPayload = (): SurveyAnswer[] => {
    if (!survey) return []
    return survey.questions.map((question) => {
      const value = answers[question.id]
      return {
        question_id: question.id,
        question_text: question.text,
        question_type: question.type,
        value_text: typeof value === 'string' ? value : null,
        value_number: typeof value === 'number' ? value : null,
        value_array: Array.isArray(value) ? value : null,
        other_text: null,
      }
    })
  }

  const submitSurvey = async () => {
    if (!survey) return
    await api.submitPublicResponse(survey.id, {
      respondent_name: survey.identity_mode === 'hidden' ? '' : name,
      respondent_email: survey.identity_mode === 'hidden' ? '' : email,
      answers: toAnswerPayload(),
    })
    setStage('submitted')
  }

  const proceedToNextStep = () => {
    const missingIds = questions
      .filter((question) => question.required && !isQuestionAnswered(question))
      .map((question) => question.id)

    if (missingIds.length > 0) {
      setMissingRequired(Object.fromEntries(missingIds.map((id) => [id, true])))
      return
    }

    setMissingRequired({})
    if (pageIndex < pages.length - 1) {
      setPageIndex(getNextPageIndex())
      return
    }
    setStage('review')
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center">Loading survey...</div>
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 10% 10%, rgba(30, 88, 224, 0.08), transparent 38%), radial-gradient(circle at 88% 18%, rgba(30, 88, 224, 0.06), transparent 32%), linear-gradient(120deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0) 42%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 163, 184, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.2) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 90%)',
          }}
        />
        <div className="max-w-3xl mx-auto relative z-10 pt-16 text-center">
          <div className="mx-auto h-28 w-28 text-primary">
            <svg viewBox="0 0 240 160" fill="none" className="h-full w-full">
              <rect x="84" y="40" width="72" height="54" rx="4" stroke="currentColor" strokeWidth="2" />
              <path d="M98 58h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M98 70h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M120 94v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M102 110h36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="170" cy="50" r="6" stroke="currentColor" strokeWidth="2" />
              <circle cx="70" cy="114" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M164 96l10 10 18-24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-6 text-lg font-medium text-destructive">{error || 'Not found'}</p>
        </div>
      </div>
    )
  }

  const identityRequired = survey.identity_mode === 'required'
  const showIdentityIntro = survey.identity_mode !== 'hidden'

  return (
    <div className="min-h-screen bg-background text-foreground p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 10% 10%, rgba(30, 88, 224, 0.08), transparent 38%), radial-gradient(circle at 88% 18%, rgba(30, 88, 224, 0.06), transparent 32%), linear-gradient(120deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0) 42%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148, 163, 184, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.2) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 90%)',
        }}
      />
      <div className="max-w-3xl mx-auto space-y-4 relative z-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{survey.title}</h1>
          <p className="text-muted-foreground">{survey.description}</p>
          {stage === 'questions' && (
            <div className="h-2 bg-accent rounded-sm overflow-hidden border border-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </header>

        {stage === 'intro' && showIdentityIntro && (
          <Card className="p-5 space-y-4">
            <h2 className="text-xl font-semibold">Before we begin</h2>
            <p className="text-sm text-muted-foreground">
              {identityRequired
                ? 'Please provide your name and email to continue.'
                : 'You can provide your name and email, or continue anonymously.'}
            </p>
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button
              onClick={() => setStage('questions')}
              disabled={identityRequired && (!name.trim() || !email.trim())}
            >
              Start Survey
            </Button>
          </Card>
        )}

        {stage === 'questions' && currentPage && (
          <Card className="p-5 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">{currentPage.title}</h2>
              <p className="text-sm text-muted-foreground">{currentPage.description}</p>
            </div>

            {questions.map((question) => (
              <div key={question.id} className="space-y-2">
                <p className="font-medium">
                  {question.text} {question.required && <span className="text-destructive">*</span>}
                </p>

                {question.type === 'single_choice' &&
                  (question.options ?? []).map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === option}
                        onChange={() => setAnswer(question, option)}
                      />
                      {option}
                    </label>
                  ))}

                {question.type === 'multiple_choice' &&
                  (question.options ?? []).map((option) => {
                    const current = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : []
                    const checked = current.includes(option)
                    return (
                      <label key={option} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...current, option]
                              : current.filter((item) => item !== option)
                            setAnswer(question, next)
                          }}
                        />
                        {option}
                      </label>
                    )
                  })}

                {(question.type === 'text' || question.type === 'multi_text') && (
                  <Textarea
                    rows={4}
                    value={String(answers[question.id] ?? '')}
                    onChange={(event) => setAnswer(question, event.target.value)}
                  />
                )}

                {question.type === 'rating' && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`h-9 w-9 border border-border rounded-sm ${
                          answers[question.id] === value ? 'bg-primary text-primary-foreground' : ''
                        }`}
                        onClick={() => setAnswer(question, value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}

                {question.type === 'yes_no' && (
                  <div className="flex gap-2">
                    {['yes', 'no'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`h-9 px-4 border border-border rounded-sm uppercase ${
                          answers[question.id] === value ? 'bg-primary text-primary-foreground' : ''
                        }`}
                        onClick={() => setAnswer(question, value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}

                {question.required && missingRequired[question.id] && (
                  <p className="text-xs text-destructive">This question is required.</p>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}>
                Previous
              </Button>
              {pageIndex < pages.length - 1 ? (
                <Button onClick={proceedToNextStep}>Next</Button>
              ) : (
                <Button onClick={proceedToNextStep}>Review</Button>
              )}
            </div>
          </Card>
        )}

        {stage === 'review' && (
          <Card className="p-5 space-y-4">
            <h2 className="text-xl font-semibold">Review your answers</h2>
            <div className="space-y-2">
              {survey.questions.map((question) => (
                <div key={question.id} className="border border-border rounded-sm p-2">
                  <p className="font-medium text-sm">{question.text}</p>
                  <Mono className="text-xs text-muted-foreground">
                    {Array.isArray(answers[question.id])
                      ? (answers[question.id] as string[]).join(', ')
                      : String(answers[question.id] ?? '-')}
                  </Mono>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStage('questions')}>
                Back to edit
              </Button>
              <Button onClick={submitSurvey}>Confirm and Submit</Button>
            </div>
          </Card>
        )}

        {stage === 'submitted' && (
          <Card className="p-6 text-center space-y-2">
            <h2 className="text-2xl font-semibold">Thank you</h2>
            <p className="text-muted-foreground">Your response has been recorded.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
