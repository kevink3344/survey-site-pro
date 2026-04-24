import cors from 'cors'
import express from 'express'
import YAML from 'yamljs'
import swaggerUi from 'swagger-ui-express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { repo, seedDemoData, seedRecentResponsesOnly } from './db.js'
import type {
  Survey,
  SurveyAnswer,
  SurveyResponse,
  SurveyVersion,
} from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const clientDistPath = join(__dirname, '..', 'dist')
const app = express()
const port = Number(process.env.PORT ?? 8787)

const pageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  order: z.number().int().nonnegative(),
})

const branchingRuleSchema = z.object({
  value: z.string().min(1),
  goToPageId: z.string().min(1),
})

const questionSchema = z.object({
  id: z.string().min(1),
  page_id: z.string().min(1),
  order: z.number().int().nonnegative(),
  type: z.enum(['single_choice', 'multiple_choice', 'text', 'rating', 'yes_no']),
  text: z.string().min(1),
  required: z.boolean(),
  options: z.array(z.string()).optional().default([]),
  branching: z.array(branchingRuleSchema).optional().default([]),
})

const surveySchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  type: z.enum(['onboarding', 'offboarding']),
  status: z.enum(['published', 'unpublished']),
  identity_mode: z.enum(['required', 'optional', 'hidden']).default('required'),
  slug: z.string().min(1),
  access_code: z.string().min(1),
  pages: z.array(pageSchema).default([]),
  questions: z.array(questionSchema).default([]),
})

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  type: z.enum(['onboarding', 'offboarding']),
  identity_mode: z.enum(['required', 'optional', 'hidden']).default('required'),
  pages: z.array(pageSchema).default([]),
  questions: z.array(questionSchema).default([]),
})

const answerSchema = z.object({
  question_id: z.string(),
  question_text: z.string(),
  question_type: z.enum(['single_choice', 'multiple_choice', 'text', 'rating', 'yes_no']),
  value_text: z.string().nullable().optional(),
  value_number: z.number().nullable().optional(),
  value_array: z.array(z.string()).nullable().optional(),
  other_text: z.string().nullable().optional(),
})

const createResponseSchema = z.object({
  respondent_name: z.string().optional().default(''),
  respondent_email: z.string().optional().default(''),
  answers: z.array(answerSchema).default([]),
})

function isSameVersionSnapshot(survey: Survey, version: SurveyVersion) {
  return (
    survey.title === version.title &&
    survey.description === version.description &&
    survey.type === version.type &&
    survey.identity_mode === version.identity_mode &&
    survey.slug === version.slug &&
    survey.access_code === version.access_code &&
    JSON.stringify(survey.pages) === JSON.stringify(version.pages) &&
    JSON.stringify(survey.questions) === JSON.stringify(version.questions)
  )
}

function ensurePublishedVersion(survey: Survey, forceNew = false) {
  const latest = repo.getLatestSurveyVersionForSurvey(survey.id)
  if (!latest || forceNew || !isSameVersionSnapshot(survey, latest)) {
    return repo.createSurveyVersionFromSurvey(survey)
  }
  return latest
}

app.use(cors())
app.use(express.json())
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
}

const openApiPath = join(__dirname, 'docs', 'openapi.yaml')
if (existsSync(openApiPath)) {
  const openApi = YAML.load(openApiPath)
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi))
} else {
  console.warn(`Using fallback OpenAPI docs: missing file at ${openApiPath}`)
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup({
      openapi: '3.0.3',
      info: {
        title: 'HR Survey API',
        version: '1.0.0',
        description: 'Fallback API docs loaded because openapi.yaml was not found at runtime.',
      },
      paths: {
        '/api/health': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'API available',
              },
            },
          },
        },
      },
    })
  )
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/admin/seed', (_req, res) => {
  const result = seedDemoData()
  res.status(201).json(result)
})

app.post('/api/admin/seed/responses', (_req, res) => {
  const result = seedRecentResponsesOnly(14)
  res.status(201).json(result)
})

app.get('/api/dashboard', (_req, res) => {
  const surveys = repo.listSurveys()
  const responses = repo.listResponses({})

  const today = new Date()
  const lineSeries = Array.from({ length: 14 }).map((_, idx) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (13 - idx))
    const key = day.toISOString().slice(0, 10)
    return {
      date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      key,
      count: 0,
    }
  })

  for (const response of responses) {
    const key = response.submitted_at.slice(0, 10)
    const slot = lineSeries.find((item) => item.key === key)
    if (slot) {
      slot.count += 1
    }
  }

  const responseBySurvey = surveys.map((survey: Survey) => ({
    surveyId: survey.id,
    title: survey.title,
    responses: responses.filter((r: SurveyResponse) => r.survey_id === survey.id).length,
  }))

  // Build per-day per-survey breakdown so the frontend can cross-filter
  const dailyBySurvey: Record<string, Array<{ surveyId: string; title: string; responses: number }>> = {}
  for (const slot of lineSeries) {
    const dayResponses = responses.filter((r: SurveyResponse) => r.submitted_at.slice(0, 10) === slot.key)
    dailyBySurvey[slot.key] = surveys
      .map((survey: Survey) => ({
        surveyId: survey.id,
        title: survey.title,
        responses: dayResponses.filter((r: SurveyResponse) => r.survey_id === survey.id).length,
      }))
      .filter((s) => s.responses > 0)
  }

  const recentSurveys = surveys.slice(0, 5).map((survey: Survey) => ({
    ...survey,
    response_count: responses.filter((r: SurveyResponse) => r.survey_id === survey.id).length,
  }))

  res.json({
    stats: {
      total_surveys: surveys.length,
      published_surveys: surveys.filter((s: Survey) => s.status === 'published').length,
      onboarding_responses: responses.filter((r: SurveyResponse) => r.survey_type === 'onboarding').length,
      offboarding_responses: responses.filter((r: SurveyResponse) => r.survey_type === 'offboarding').length,
    },
    responses_last_14_days: lineSeries,
    responses_by_survey: responseBySurvey,
    daily_responses_by_survey: dailyBySurvey,
    recent_surveys: recentSurveys,
  })
})

app.get('/api/surveys', (_req, res) => {
  const surveys = repo.listSurveys()
  const responseCount = repo.listResponses({})
  res.json(
    surveys.map((survey: Survey) => ({
      ...survey,
      active_version_number: repo.getLatestSurveyVersionForSurvey(survey.id)?.version_number ?? null,
      response_count: responseCount.filter((r: SurveyResponse) => r.survey_id === survey.id).length,
    }))
  )
})

app.post('/api/surveys', (req, res) => {
  const parsed = surveySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const created = repo.createSurvey(parsed.data)
  if (created.status === 'published') {
    ensurePublishedVersion(created)
  }
  res.status(201).json(created)
})

app.get('/api/surveys/:id', (req, res) => {
  const survey = repo.getSurvey(req.params.id)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }
  const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id)
  res.json({
    ...survey,
    active_version_number: latestVersion?.version_number ?? null,
  })
})

app.get('/api/surveys/:id/versions', (req, res) => {
  const survey = repo.getSurvey(req.params.id)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }

  const versions = repo.listSurveyVersions(survey.id)
  res.json(versions)
})

app.put('/api/surveys/:id', (req, res) => {
  const parsed = surveySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const updated = repo.updateSurvey(req.params.id, parsed.data)
  if (!updated) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }
  if (updated.status === 'published') {
    ensurePublishedVersion(updated)
  }
  res.json(updated)
})

app.patch('/api/surveys/:id/status', (req, res) => {
  const survey = repo.getSurvey(req.params.id)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }

  const nextStatus = survey.status === 'published' ? 'unpublished' : 'published'
  const updated = repo.updateSurvey(survey.id, {
    title: survey.title,
    description: survey.description,
    type: survey.type,
    status: nextStatus,
    identity_mode: survey.identity_mode,
    slug: survey.slug,
    access_code: survey.access_code,
    pages: survey.pages,
    questions: survey.questions,
  })
  if (updated && nextStatus === 'published') {
    ensurePublishedVersion(updated, true)
  }
  res.json(updated)
})

app.delete('/api/surveys/:id', (req, res) => {
  const deleted = repo.deleteSurvey(req.params.id)
  if (!deleted) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }
  res.status(204).send()
})

app.get('/api/surveys/slug/:slug/:code', (req, res) => {
  const survey = repo.getSurveyBySlugAndCode(req.params.slug, req.params.code)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found or unpublished' })
    return
  }
  const version = repo.getLatestSurveyVersionForSurvey(survey.id)
  if (!version) {
    res.json(survey)
    return
  }

  res.json({
    ...survey,
    title: version.title,
    description: version.description,
    type: version.type,
    identity_mode: version.identity_mode,
    slug: version.slug,
    access_code: version.access_code,
    pages: version.pages,
    questions: version.questions,
    active_version_number: version.version_number,
  })
})

app.get('/api/templates', (_req, res) => {
  const templates = repo.listTemplates()
  res.json(templates)
})

app.post('/api/templates', (req, res) => {
  const parsed = templateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const created = repo.createTemplate(parsed.data)
  res.status(201).json(created)
})

app.put('/api/templates/:id', (req, res) => {
  const parsed = templateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const updated = repo.updateTemplate(req.params.id, parsed.data)
  if (!updated) {
    res.status(404).json({ error: 'Template not found' })
    return
  }

  res.json(updated)
})

app.delete('/api/templates/:id', (req, res) => {
  const deleted = repo.deleteTemplate(req.params.id)
  if (!deleted) {
    res.status(404).json({ error: 'Template not found' })
    return
  }

  res.status(204).send()
})

app.get('/api/responses', (req, res) => {
  const responses = repo.listResponses({
    search: String(req.query.search ?? ''),
    type: String(req.query.type ?? ''),
    surveyId: String(req.query.surveyId ?? ''),
  })
  res.json(responses)
})

app.get('/api/responses/:id', (req, res) => {
  const response = repo.getResponse(req.params.id)
  if (!response) {
    res.status(404).json({ error: 'Response not found' })
    return
  }
  res.json(response)
})

app.post('/api/surveys/:id/responses', (req, res) => {
  const survey = repo.getSurvey(req.params.id)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }

  const parsed = createResponseSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const rawName = (parsed.data.respondent_name ?? '').trim()
  const rawEmail = (parsed.data.respondent_email ?? '').trim()

  if (survey.identity_mode === 'required' && (!rawName || !rawEmail)) {
    res.status(400).json({ error: 'Name and email are required for this survey.' })
    return
  }

  if (rawEmail && !z.string().email().safeParse(rawEmail).success) {
    res.status(400).json({ error: 'Please provide a valid email address.' })
    return
  }

  const respondentName = survey.identity_mode === 'hidden' ? '' : rawName
  const respondentEmail = survey.identity_mode === 'hidden' ? '' : rawEmail
  const surveyVersion = repo.getLatestSurveyVersionForSurvey(survey.id)
  const resolvedVersion = survey.status === 'published' ? surveyVersion ?? ensurePublishedVersion(survey) : null

  const response = repo.createResponse({
    survey_id: survey.id,
    survey_version_id: resolvedVersion?.id ?? null,
    survey_title: survey.title,
    survey_type: survey.type,
    respondent_name: respondentName,
    respondent_email: respondentEmail,
    answers: parsed.data.answers as SurveyAnswer[],
  })

  res.status(201).json(response)
})

app.get('/api/surveys/:id/results', (req, res) => {
  const survey = repo.getSurvey(req.params.id)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }

  const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id)
  const surveyShape = latestVersion
    ? {
        ...survey,
        title: latestVersion.title,
        description: latestVersion.description,
        type: latestVersion.type,
        identity_mode: latestVersion.identity_mode,
        slug: latestVersion.slug,
        access_code: latestVersion.access_code,
        pages: latestVersion.pages,
        questions: latestVersion.questions,
        active_version_number: latestVersion.version_number,
      }
    : survey

  const responses = latestVersion
    ? repo.getSurveyResponses(req.params.id, latestVersion.id, true)
    : repo.getSurveyResponses(req.params.id)

  const byQuestion = surveyShape.questions.map((q) => {
    const answers = responses
      .map((response: SurveyResponse) =>
        response.answers.find((a: SurveyAnswer) => a.question_id === q.id)
      )
      .filter(Boolean) as SurveyAnswer[]

    if (q.type === 'rating') {
      const values = answers
        .map((a) => a.value_number)
        .filter((v): v is number => typeof v === 'number')
      const average = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0
      return {
        question_id: q.id,
        question_text: q.text,
        question_type: q.type,
        rating_average: Number(average.toFixed(2)),
        distribution: [1, 2, 3, 4, 5].map((value) => ({
          label: String(value),
          count: values.filter((v) => v === value).length,
        })),
      }
    }

    if (q.type === 'text') {
      return {
        question_id: q.id,
        question_text: q.text,
        question_type: q.type,
        texts: answers
          .map((a) => a.value_text)
          .filter((v): v is string => Boolean(v && v.trim())),
      }
    }

    const tally = new Map<string, number>()
    for (const answer of answers) {
      const values =
        answer.value_array && answer.value_array.length > 0
          ? answer.value_array
          : [answer.value_text ?? 'No answer']
      for (const value of values) {
        const current = tally.get(value) ?? 0
        tally.set(value, current + 1)
      }
    }

    return {
      question_id: q.id,
      question_text: q.text,
      question_type: q.type,
      distribution: Array.from(tally.entries()).map(([label, count]) => ({
        label,
        count,
      })),
    }
  })

  res.json({
    survey: surveyShape,
    survey_version: latestVersion,
    response_count: responses.length,
    questions: byQuestion,
    individual: responses,
  })
})

app.post('/api/surveys/:id/copy-url', (req, res) => {
  const survey = repo.getSurvey(req.params.id)
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' })
    return
  }

  const next = repo.updateSurvey(survey.id, {
    ...survey,
    access_code: nanoid(8).toUpperCase(),
  })
  res.json(next)
})

if (existsSync(clientDistPath)) {
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`)
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`)
})
