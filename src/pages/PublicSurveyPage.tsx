import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { api } from '../lib/api'
import { copyText, formatDate } from '../lib/helpers'
import type {
  Survey,
  SurveyAnswer,
  SurveyAttachmentValue,
  SurveyDraft,
  SurveyDraftStage,
  SurveyQuestion,
  SurveySignatureValue,
  SurveyTableRow,
} from '../types'
import { Button, Card, Input, Textarea, Mono } from '../components/ui'

type Stage = SurveyDraftStage | 'submitted'
type AutosaveState = 'idle' | 'saving' | 'saved' | 'offline-retrying' | 'error'
type AnswerValue =
  | string
  | number
  | string[]
  | SurveyAttachmentValue[]
  | SurveySignatureValue
  | SurveyTableRow[]

const MAX_ATTACHMENT_FILES = 3
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024
const SIGNATURE_CANVAS_WIDTH = 640
const SIGNATURE_CANVAS_HEIGHT = 220

const getDraftStorageKey = (slug: string, code: string) => `survey-draft:${slug}:${code}`

function answersToState(draftAnswers: SurveyAnswer[]) {
  const next: Record<string, AnswerValue> = {}

  for (const answer of draftAnswers) {
    if (Array.isArray(answer.value_table_rows) && answer.value_table_rows.length > 0) {
      next[answer.question_id] = answer.value_table_rows
      continue
    }

    if (Array.isArray(answer.value_attachments) && answer.value_attachments.length > 0) {
      next[answer.question_id] = answer.value_attachments
      continue
    }

    if (answer.value_signature && typeof answer.value_signature.data_url === 'string') {
      next[answer.question_id] = answer.value_signature
      continue
    }

    if (Array.isArray(answer.value_array) && answer.value_array.length > 0) {
      next[answer.question_id] = answer.value_array
      continue
    }

    if (typeof answer.value_number === 'number') {
      next[answer.question_id] = answer.value_number
      continue
    }

    if (typeof answer.value_text === 'string' && answer.value_text.length > 0) {
      next[answer.question_id] = answer.value_text
    }
  }

  return next
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Invalid file data.'))
    }
    reader.onerror = () => reject(new Error('Unable to read selected file.'))
    reader.readAsDataURL(file)
  })
}

type SignaturePadProps = {
  value: SurveySignatureValue | null
  onChange: (value: SurveySignatureValue | null) => void
}

function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  const drawFromValue = (signatureValue: SurveySignatureValue | null) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, SIGNATURE_CANVAS_WIDTH, SIGNATURE_CANVAS_HEIGHT)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, SIGNATURE_CANVAS_WIDTH, SIGNATURE_CANVAS_HEIGHT)

    if (!signatureValue?.data_url) {
      return
    }

    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0, SIGNATURE_CANVAS_WIDTH, SIGNATURE_CANVAS_HEIGHT)
    }
    image.src = signatureValue.data_url
  }

  useEffect(() => {
    drawFromValue(value)
  }, [value])

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()
    const scaleX = SIGNATURE_CANVAS_WIDTH / rect.width
    const scaleY = SIGNATURE_CANVAS_HEIGHT / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const commitSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    onChange({
      mime_type: 'image/png',
      data_url: dataUrl,
      width: SIGNATURE_CANVAS_WIDTH,
      height: SIGNATURE_CANVAS_HEIGHT,
      signed_at: new Date().toISOString(),
    })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.setPointerCapture(event.pointerId)
    const context = canvas.getContext('2d')
    if (!context) return

    const point = getPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.lineWidth = 2
    context.lineCap = 'round'
    context.strokeStyle = '#111827'
    drawingRef.current = true
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }

    if (!drawingRef.current) return

    drawingRef.current = false
    commitSignature()
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={SIGNATURE_CANVAS_WIDTH}
        height={SIGNATURE_CANVAS_HEIGHT}
        className="w-full max-w-[640px] h-[220px] border border-border rounded-sm bg-white touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            drawFromValue(null)
            onChange(null)
          }}
        >
          Clear Signature
        </Button>
      </div>
    </div>
  )
}

export function PublicSurveyPage() {
  const { slug = '', code = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [missingRequired, setMissingRequired] = useState<Record<string, boolean>>({})
  const [attachmentErrors, setAttachmentErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [draftToken, setDraftToken] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [draftStatus, setDraftStatus] = useState('')
  const [draftError, setDraftError] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingRetry, setPendingRetry] = useState(false)
  const saveInFlightRef = useRef(false)
  const draftStorageKey = useMemo(() => getDraftStorageKey(slug, code), [slug, code])
  const resumeParam = searchParams.get('resume') ?? ''

  const syncDraftToken = (nextToken: string) => {
    setDraftToken(nextToken)
    window.localStorage.setItem(draftStorageKey, nextToken)
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('resume', nextToken)
      return next
    }, { replace: true })
  }

  const clearDraftToken = () => {
    setDraftToken('')
    setLastSavedAt('')
    window.localStorage.removeItem(draftStorageKey)
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('resume')
      return next
    }, { replace: true })
  }

  const restoreDraft = (draft: SurveyDraft, nextSurvey: Survey) => {
    setName(draft.respondent_name)
    setEmail(draft.respondent_email)
    setAnswers(answersToState(draft.answers))
    setPageIndex(Math.min(draft.current_page_index, Math.max(nextSurvey.pages.length - 1, 0)))
    setStage(nextSurvey.identity_mode === 'hidden' && draft.current_stage === 'intro' ? 'questions' : draft.current_stage)
    setLastSavedAt(draft.updated_at)
    setDraftStatus('Draft restored. You can continue where you left off.')
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
      if (survey?.save_resume_enabled && stage !== 'submitted') {
        setAutosaveState('offline-retrying')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [stage, survey?.save_resume_enabled])

  useEffect(() => {
    if (autosaveState !== 'saved') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setAutosaveState('idle')
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [autosaveState])

  useEffect(() => {
    if (
      !pendingRetry ||
      !isOnline ||
      !draftReady ||
      !survey?.save_resume_enabled ||
      stage === 'submitted'
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void saveDraft(false)
    }, survey?.autosave_timeout_ms ?? 1500)

    return () => window.clearTimeout(timeoutId)
  }, [draftReady, isOnline, pendingRetry, stage, survey?.save_resume_enabled])

  useEffect(() => {
    if (isOnline && autosaveState === 'offline-retrying' && !pendingRetry) {
      setAutosaveState('idle')
    }
  }, [autosaveState, isOnline, pendingRetry])

  useEffect(() => {
    let cancelled = false

    const loadSurvey = async () => {
      setLoading(true)
      setDraftReady(false)
      setError('')
      setDraftStatus('')
      setDraftError('')
      setName('')
      setEmail('')
      setAnswers({})
      setPageIndex(0)

      try {
        const nextSurvey = await api.getPublicSurvey(slug, code)
        if (cancelled) return

        setSurvey(nextSurvey)

        if (!nextSurvey.save_resume_enabled) {
          clearDraftToken()
          setStage(nextSurvey.identity_mode === 'hidden' ? 'questions' : 'intro')
          return
        }

        const requestedToken = resumeParam || window.localStorage.getItem(draftStorageKey) || ''
        if (!requestedToken) {
          setStage(nextSurvey.identity_mode === 'hidden' ? 'questions' : 'intro')
          return
        }

        try {
          const draft = await api.getSurveyDraft(nextSurvey.id, requestedToken)
          if (cancelled) return

          syncDraftToken(draft.resume_token)
          restoreDraft(draft, nextSurvey)
        } catch {
          if (cancelled) return
          clearDraftToken()
          setStage(nextSurvey.identity_mode === 'hidden' ? 'questions' : 'intro')
          setDraftError('This resume link is no longer available. Start a new response to continue.')
        }
      } catch {
        if (cancelled) return
        setError('This survey is not available yet. It may be unpublished or the link may be invalid.')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setDraftReady(true)
        }
      }
    }

    void loadSurvey()

    return () => {
      cancelled = true
    }
  }, [slug, code, resumeParam, draftStorageKey])

  const pages = useMemo(() => [...(survey?.pages ?? [])].sort((a, b) => a.order - b.order), [survey])
  const pageIndexById = useMemo(() => {
    return new Map(pages.map((page, index) => [page.id, index]))
  }, [pages])
  const orderedQuestions = useMemo(() => {
    if (!survey) {
      return []
    }

    return [...survey.questions].sort((a, b) => {
      const pageOrderDiff = (pageIndexById.get(a.page_id) ?? 0) - (pageIndexById.get(b.page_id) ?? 0)
      if (pageOrderDiff !== 0) {
        return pageOrderDiff
      }
      return a.order - b.order
    })
  }, [pageIndexById, survey])
  const currentPage = pages[pageIndex]
  const questions = useMemo(
    () =>
      (survey?.questions ?? [])
        .filter((q) => q.page_id === currentPage?.id)
        .sort((a, b) => a.order - b.order),
    [survey, currentPage]
  )

  const progress = pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 0
  const resumeUrl = useMemo(() => {
    if (!draftToken) {
      return ''
    }

    return `${window.location.origin}/s/${slug}/${code}?resume=${draftToken}`
  }, [code, draftToken, slug])

  const hasDraftProgress = useMemo(() => {
    if (name.trim() || email.trim()) {
      return true
    }

    return Object.values(answers).some((value) => {
      if (value && typeof value === 'object' && 'data_url' in value) {
        return String(value.data_url ?? '').trim().length > 0
      }

      if (Array.isArray(value)) {
        return value.length > 0
      }

      if (typeof value === 'number') {
        return true
      }

      return String(value).trim().length > 0
    })
  }, [answers, email, name])

  const isQuestionAnswered = (question: SurveyQuestion) => {
    const value = answers[question.id]
    if (value === undefined || value === null) {
      return false
    }

    if (question.type === 'table') {
      return Array.isArray(value) && value.length > 0
    }

    if (question.type === 'attachment') {
      return Array.isArray(value) && value.length > 0
    }

    if (question.type === 'signature') {
      return Boolean(
        value && typeof value === 'object' && 'data_url' in value && String(value.data_url).length > 0
      )
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

  const answeredQuestionCount = useMemo(() => {
    return orderedQuestions.reduce((count, question) => {
      return count + (isQuestionAnswered(question) ? 1 : 0)
    }, 0)
  }, [answers, orderedQuestions])
  const questionCompletionPercent = orderedQuestions.length > 0
    ? Math.round((answeredQuestionCount / orderedQuestions.length) * 100)
    : 0
  const unansweredRemaining = Math.max(0, orderedQuestions.length - answeredQuestionCount)
  const estimatedMinutesRemaining = Math.max(1, Math.ceil(unansweredRemaining / 3))

  const setAnswer = (question: SurveyQuestion, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
    setAttachmentErrors((prev) => {
      if (!prev[question.id]) return prev
      const next = { ...prev }
      delete next[question.id]
      return next
    })
    setMissingRequired((prev) => {
      if (!prev[question.id]) return prev
      const next = { ...prev }
      delete next[question.id]
      return next
    })
  }

  const getTableRows = (question: SurveyQuestion): SurveyTableRow[] => {
    const value = answers[question.id]
    if (!Array.isArray(value)) {
      return []
    }

    return value.filter((entry): entry is SurveyTableRow => {
      return Boolean(entry && typeof entry === 'object' && !('data_url' in entry) && !('name' in entry))
    })
  }

  const createEmptyTableRow = (question: SurveyQuestion): SurveyTableRow => {
    const columns = question.table_schema?.columns ?? []
    const row: SurveyTableRow = {}
    for (const column of columns) {
      row[column.key] = ''
    }
    return row
  }

  const addTableRow = (question: SurveyQuestion) => {
    const rows = getTableRows(question)
    const maxRows = question.table_schema?.max_rows ?? 25
    if (rows.length >= maxRows) {
      return
    }
    setAnswer(question, [...rows, createEmptyTableRow(question)])
  }

  const removeTableRow = (question: SurveyQuestion, index: number) => {
    const rows = getTableRows(question)
    const minRows = question.table_schema?.min_rows ?? 0
    if (rows.length <= minRows) {
      return
    }
    setAnswer(
      question,
      rows.filter((_, rowIndex) => rowIndex !== index)
    )
  }

  const updateTableCell = (question: SurveyQuestion, rowIndex: number, columnKey: string, value: string) => {
    const rows = getTableRows(question)
    const nextRows = rows.map((row, index) =>
      index === rowIndex
        ? {
            ...row,
            [columnKey]: value,
          }
        : row
    )
    setAnswer(question, nextRows)
  }

  const renderTableInput = (question: SurveyQuestion, row: SurveyTableRow, rowIndex: number, columnKey: string, columnType: string) => (
    <input
      type={
        columnType === 'email'
          ? 'email'
          : columnType === 'number'
            ? 'number'
            : columnType === 'date'
              ? 'date'
              : 'text'
      }
      value={row[columnKey] ?? ''}
      onChange={(event) => updateTableCell(question, rowIndex, columnKey, event.target.value)}
      className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-primary"
    />
  )

  const setAttachmentError = (questionId: string, message: string) => {
    setAttachmentErrors((prev) => ({ ...prev, [questionId]: message }))
  }

  const clearAttachmentError = (questionId: string) => {
    setAttachmentErrors((prev) => {
      if (!prev[questionId]) return prev
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  const handleAttachmentChange = async (question: SurveyQuestion, files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    const selected = Array.from(files)
    if (selected.length > MAX_ATTACHMENT_FILES) {
      setAttachmentError(question.id, `Attach up to ${MAX_ATTACHMENT_FILES} files.`)
      return
    }

    for (const file of selected) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachmentError(question.id, `${file.name} is larger than 5MB.`)
        return
      }
    }

    try {
      const attachments = await Promise.all(
        selected.map(async (file) => ({
          name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          data_url: await readFileAsDataUrl(file),
        }))
      )
      clearAttachmentError(question.id)
      setAnswer(question, attachments)
    } catch {
      setAttachmentError(question.id, 'Unable to read selected file(s). Try again.')
    }
  }

  const normalizeValue = (value: string | number) => String(value).trim().toLowerCase()

  const getNextPageIndex = () => {
    if (!survey || !currentPage) {
      return Math.min(pages.length - 1, pageIndex + 1)
    }

    for (const question of questions) {
      const answer = answers[question.id]
      if (answer === undefined || answer === null) continue

      if (question.type !== 'single_choice' && question.type !== 'yes_no') {
        continue
      }

      const answerValues = Array.isArray(answer)
        ? answer
            .filter((item): item is string => typeof item === 'string')
            .map((item) => normalizeValue(item))
        : [normalizeValue(answer as string | number)]

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
      const valueSignature =
        question.type === 'signature' && value && typeof value === 'object' && !Array.isArray(value) && 'data_url' in value
          ? (value as SurveySignatureValue)
          : null

      const valueAttachments = question.type === 'attachment' && Array.isArray(value)
        ? value.filter((item): item is SurveyAttachmentValue => {
            return Boolean(item && typeof item === 'object' && 'data_url' in item && 'name' in item)
          })
        : null

      const valueArray = question.type === 'multiple_choice' && Array.isArray(value)
        ? value.every((item) => typeof item === 'string')
          ? (value as string[])
          : null
        : null

      const valueTableRows =
        question.type === 'table' && Array.isArray(value)
          ? value.filter((item): item is SurveyTableRow => {
              return Boolean(
                item && typeof item === 'object' && !('data_url' in item) && !('name' in item)
              )
            })
          : null

      return {
        question_id: question.id,
        question_text: question.text,
        question_type: question.type,
        value_text: typeof value === 'string' ? value : null,
        value_number: typeof value === 'number' ? value : null,
        value_array: valueArray,
        value_attachments: valueAttachments,
        value_signature: valueSignature,
        value_table_rows: valueTableRows,
        other_text: null,
      }
    })
  }

  const getDraftPayload = () => ({
    respondent_name: survey?.identity_mode === 'hidden' ? '' : name,
    respondent_email: survey?.identity_mode === 'hidden' ? '' : email,
    answers: toAnswerPayload(),
    current_stage: (stage === 'submitted' ? 'review' : stage) as SurveyDraftStage,
    current_page_index: pageIndex,
  })

  const saveDraft = async (manual: boolean) => {
    if (!survey?.save_resume_enabled || !survey || stage === 'submitted') {
      return null
    }

    if (!manual && !hasDraftProgress && !draftToken) {
      return null
    }

    if (saveInFlightRef.current) {
      return draftToken || null
    }

    if (!manual && !isOnline) {
      setPendingRetry(true)
      setAutosaveState('offline-retrying')
      return draftToken || null
    }

    saveInFlightRef.current = true
    setDraftSaving(true)
    setDraftError('')
    if (!manual) {
      setAutosaveState('saving')
    }

    try {
      const payload = getDraftPayload()
      const draft = draftToken
        ? await api.updateSurveyDraft(survey.id, draftToken, payload)
        : await api.createSurveyDraft(survey.id, payload)

      syncDraftToken(draft.resume_token)
      setLastSavedAt(draft.updated_at)
      if (manual) {
        setDraftStatus('Progress saved. Use the resume link to return later.')
      } else {
        setDraftStatus('')
        setAutosaveState('saved')
        setPendingRetry(false)
      }
      return draft.resume_token
    } catch {
      const offlineNow = !navigator.onLine
      setDraftError(
        manual
          ? 'Unable to save your progress right now. Please try again.'
          : offlineNow
            ? ''
            : 'Autosave could not reach the server. Your latest changes are only in this browser for now.'
      )

      if (!manual) {
        if (offlineNow) {
          setAutosaveState('offline-retrying')
          setPendingRetry(true)
        } else {
          setAutosaveState('error')
          setPendingRetry(true)
        }
      }
      return null
    } finally {
      saveInFlightRef.current = false
      setDraftSaving(false)
    }
  }

  const submitSurvey = async () => {
    if (!survey) return

    setSubmitting(true)
    setDraftError('')

    try {
      let responseDraftToken = draftToken
      if (survey.save_resume_enabled) {
        responseDraftToken = (await saveDraft(false)) ?? responseDraftToken
      }

      if (responseDraftToken) {
        await api.submitSurveyDraft(survey.id, responseDraftToken)
      } else {
        await api.submitPublicResponse(survey.id, {
          respondent_name: survey.identity_mode === 'hidden' ? '' : name,
          respondent_email: survey.identity_mode === 'hidden' ? '' : email,
          answers: toAnswerPayload(),
        })
      }

      clearDraftToken()
      setDraftStatus('')
      setStage('submitted')
    } catch {
      setDraftError('Unable to submit your response right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (
      !draftReady ||
      !survey?.save_resume_enabled ||
      stage === 'submitted' ||
      !hasDraftProgress ||
      pendingRetry
    ) {
      if (!isOnline && survey?.save_resume_enabled && hasDraftProgress) {
        setAutosaveState('offline-retrying')
        setPendingRetry(true)
      }
      return
    }

    const timeoutId = window.setTimeout(() => {
      void saveDraft(false)
    }, survey?.autosave_timeout_ms ?? 1500)

    return () => window.clearTimeout(timeoutId)
  }, [
    answers,
    draftReady,
    email,
    hasDraftProgress,
    isOnline,
    name,
    pageIndex,
    pendingRetry,
    stage,
    survey?.id,
    survey?.save_resume_enabled,
  ])

  const autosaveStatusText = useMemo(() => {
    if (!survey?.save_resume_enabled || stage === 'submitted') {
      return ''
    }

    if (!hasDraftProgress && !draftToken) {
      return 'Autosave ready'
    }

    if (autosaveState === 'saving' || draftSaving) {
      return 'Saving...'
    }

    if (autosaveState === 'saved') {
      return 'Saved just now'
    }

    if (autosaveState === 'offline-retrying' || !isOnline) {
      return 'Offline, will retry'
    }

    if (autosaveState === 'error') {
      return 'Saving delayed, retrying soon'
    }

    if (lastSavedAt) {
      return `Last saved ${formatDate(lastSavedAt)}`
    }

    return 'Autosave ready'
  }, [autosaveState, draftSaving, draftToken, hasDraftProgress, isOnline, lastSavedAt, stage, survey?.save_resume_enabled])

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
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 relative overflow-hidden">
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
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 relative overflow-hidden">
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
        {survey.cover_image_url && (
          <div className="rounded-sm border border-border overflow-hidden bg-muted">
            <div className="relative aspect-[16/8] w-full">
              <img
                src={survey.cover_image_url}
                alt={survey.cover_image_alt || `${survey.title} cover photo`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
            </div>
          </div>
        )}

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{survey.title}</h1>
          <p className="text-muted-foreground">{survey.description}</p>
          {stage === 'questions' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Page {Math.min(pageIndex + 1, Math.max(1, pages.length))} of {Math.max(1, pages.length)}</span>
                <span>{questionCompletionPercent}% complete</span>
                <span>
                  ~{estimatedMinutesRemaining} min remaining
                </span>
              </div>
              <div className="h-2 bg-accent rounded-sm overflow-hidden border border-border">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </header>

        {survey.save_resume_enabled && stage !== 'submitted' && (
          <Card className="p-4 space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Save and resume later
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your progress can be saved and restored from a personal resume link.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void saveDraft(true)} disabled={draftSaving || submitting}>
                  {draftSaving ? 'Saving...' : 'Save and Return Later'}
                </Button>
                {resumeUrl && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void copyText(resumeUrl)
                      setDraftStatus('Resume link copied.')
                    }}
                  >
                    Copy Resume Link
                  </Button>
                )}
              </div>
            </div>
            <p className={`text-xs ${autosaveState === 'offline-retrying' ? 'text-amber-700' : 'text-muted-foreground'}`}>
              {autosaveStatusText}
            </p>
            {draftStatus && <p className="text-sm text-foreground">{draftStatus}</p>}
            {draftError && <p className="text-sm text-destructive">{draftError}</p>}
          </Card>
        )}

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
            <Button onClick={() => setStage('questions')} disabled={identityRequired && (!name.trim() || !email.trim())}>
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

                {question.type === 'attachment' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      multiple
                      onChange={(event) => {
                        void handleAttachmentChange(question, event.target.files)
                        event.currentTarget.value = ''
                      }}
                      className="h-9 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none file:mr-3 file:border-0 file:bg-transparent file:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">Upload up to 3 files, max 5MB each.</p>
                    {Array.isArray(answers[question.id]) &&
                      (answers[question.id] as SurveyAttachmentValue[]).length > 0 && (
                        <div className="space-y-1">
                          {(answers[question.id] as SurveyAttachmentValue[]).map((attachment) => (
                            <div
                              key={`${question.id}-${attachment.name}`}
                              className="text-xs border border-border rounded-sm px-2 py-1"
                            >
                              {attachment.name} ({Math.max(1, Math.round(attachment.size_bytes / 1024))} KB)
                            </div>
                          ))}
                          <Button type="button" variant="ghost" onClick={() => setAnswer(question, [])}>
                            Clear attachments
                          </Button>
                        </div>
                      )}
                    {attachmentErrors[question.id] && (
                      <p className="text-xs text-destructive">{attachmentErrors[question.id]}</p>
                    )}
                  </div>
                )}

                {question.type === 'signature' && (
                  <SignaturePad
                    value={
                      answers[question.id] &&
                      typeof answers[question.id] === 'object' &&
                      !Array.isArray(answers[question.id])
                        ? (answers[question.id] as SurveySignatureValue)
                        : null
                    }
                    onChange={(signature) => {
                      if (signature) {
                        setAnswer(question, signature)
                        return
                      }

                      setAnswers((prev) => {
                        const next = { ...prev }
                        delete next[question.id]
                        return next
                      })
                    }}
                  />
                )}

                {question.type === 'table' && (
                  <div className="space-y-3">
                    <div className="space-y-3 md:hidden">
                      {getTableRows(question).map((row, rowIndex) => (
                        <Card key={`${question.id}-mobile-row-${rowIndex}`} className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Row {rowIndex + 1}</p>
                            {(question.table_schema?.allow_delete_rows ?? true) && (
                              <Button type="button" variant="ghost" onClick={() => removeTableRow(question, rowIndex)}>
                                Remove
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {(question.table_schema?.columns ?? []).map((column) => (
                              <label key={`${question.id}-mobile-${rowIndex}-${column.key}`} className="space-y-1 block">
                                <span className="text-xs text-muted-foreground">
                                  {column.label}
                                  {column.required && <span className="text-destructive">*</span>}
                                </span>
                                {renderTableInput(question, row, rowIndex, column.key, column.type)}
                              </label>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>

                    <div className="hidden md:block overflow-x-auto border border-border rounded-sm">
                      <table className="min-w-full text-sm">
                        <thead className="bg-accent/40">
                          <tr>
                            {(question.table_schema?.columns ?? []).map((column) => (
                              <th key={`${question.id}-${column.key}`} className="text-left px-2 py-1.5 whitespace-nowrap">
                                {column.label}
                                {column.required && <span className="text-destructive">*</span>}
                              </th>
                            ))}
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {getTableRows(question).map((row, rowIndex) => (
                            <tr key={`${question.id}-row-${rowIndex}`} className="border-t border-border">
                              {(question.table_schema?.columns ?? []).map((column) => (
                                <td key={`${question.id}-${rowIndex}-${column.key}`} className="px-2 py-1.5">
                                  {renderTableInput(question, row, rowIndex, column.key, column.type)}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-right">
                                {(question.table_schema?.allow_delete_rows ?? true) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => removeTableRow(question, rowIndex)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {(question.table_schema?.allow_add_rows ?? true) && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => addTableRow(question)}
                        disabled={getTableRows(question).length >= (question.table_schema?.max_rows ?? 25)}
                      >
                        Add Row
                      </Button>
                    )}
                  </div>
                )}

                {question.required && missingRequired[question.id] && (
                  <p className="text-xs text-destructive">This question is required.</p>
                )}
              </div>
            ))}

            <div className={`flex items-center ${pageIndex > 0 ? 'justify-between' : 'justify-end'}`}>
              {pageIndex > 0 && (
                <Button variant="secondary" onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}>
                  Previous
                </Button>
              )}
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
                  {question.type === 'attachment' ? (
                    <div className="space-y-1 mt-1">
                      {Array.isArray(answers[question.id]) &&
                      (answers[question.id] as SurveyAttachmentValue[]).length > 0 ? (
                        (answers[question.id] as SurveyAttachmentValue[]).map((attachment) => (
                          <Mono key={`${question.id}-${attachment.name}`} className="block text-xs text-muted-foreground">
                            {attachment.name} ({Math.max(1, Math.round(attachment.size_bytes / 1024))} KB)
                          </Mono>
                        ))
                      ) : (
                        <Mono className="text-xs text-muted-foreground">-</Mono>
                      )}
                    </div>
                  ) : question.type === 'signature' ? (
                    <div className="mt-1">
                      {answers[question.id] &&
                      typeof answers[question.id] === 'object' &&
                      !Array.isArray(answers[question.id]) ? (
                        <img
                          src={(answers[question.id] as SurveySignatureValue).data_url}
                          alt="Signature preview"
                          className="h-20 w-auto border border-border rounded-sm bg-white"
                        />
                      ) : (
                        <Mono className="text-xs text-muted-foreground">-</Mono>
                      )}
                    </div>
                  ) : question.type === 'table' ? (
                    <div className="mt-1 space-y-1">
                      {getTableRows(question).length > 0 ? (
                        <>
                          <Mono className="text-xs text-muted-foreground">
                            {getTableRows(question).length} rows entered
                          </Mono>
                          <div className="space-y-2 md:hidden">
                            {getTableRows(question).slice(0, 3).map((row, rowIndex) => (
                              <Card key={`review-mobile-row-${question.id}-${rowIndex}`} className="p-2 space-y-1.5">
                                <p className="text-xs font-medium">Row {rowIndex + 1}</p>
                                {(question.table_schema?.columns ?? []).map((column) => (
                                  <div key={`review-mobile-cell-${question.id}-${rowIndex}-${column.key}`} className="grid grid-cols-[auto,1fr] gap-x-2 text-xs">
                                    <span className="text-muted-foreground">{column.label}</span>
                                    <span className="text-muted-foreground">{row[column.key] || '-'}</span>
                                  </div>
                                ))}
                              </Card>
                            ))}
                          </div>

                          <div className="hidden md:block overflow-x-auto border border-border rounded-sm">
                            <table className="min-w-full text-xs">
                              <thead className="bg-accent/40">
                                <tr>
                                  {(question.table_schema?.columns ?? []).map((column) => (
                                    <th key={`review-head-${question.id}-${column.key}`} className="text-left px-2 py-1">
                                      {column.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {getTableRows(question).slice(0, 3).map((row, rowIndex) => (
                                  <tr key={`review-row-${question.id}-${rowIndex}`} className="border-t border-border">
                                    {(question.table_schema?.columns ?? []).map((column) => (
                                      <td key={`review-cell-${question.id}-${rowIndex}-${column.key}`} className="px-2 py-1 text-muted-foreground">
                                        {row[column.key] || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <Mono className="text-xs text-muted-foreground">-</Mono>
                      )}
                    </div>
                  ) : (
                    <Mono className="text-xs text-muted-foreground">
                      {Array.isArray(answers[question.id])
                        ? (answers[question.id] as string[]).join(', ')
                        : String(answers[question.id] ?? '-')}
                    </Mono>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setStage('questions')}>
                Back to edit
              </Button>
              <Button onClick={submitSurvey} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Confirm and Submit'}
              </Button>
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
