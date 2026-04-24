import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { nanoid } from 'nanoid'
import type { Survey, SurveyResponse } from './types.js'

const configuredDbPath = process.env.SURVEY_DB_PATH ?? process.env.SQLITE_DB_PATH
const dbPath = configuredDbPath || join(process.cwd(), 'server', 'data', 'survey.sqlite')
const dbDir = dirname(dbPath)
if (dbDir) {
  mkdirSync(dbDir, { recursive: true })
}
const db = new Database(dbPath)

const now = () => new Date().toISOString()

db.exec(`
  CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding')),
    status TEXT NOT NULL CHECK(status IN ('published', 'unpublished')),
    identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
    slug TEXT NOT NULL,
    access_code TEXT NOT NULL,
    pages_json TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

const surveyColumns = db.prepare('PRAGMA table_info(surveys)').all() as Array<{
  name: string
}>
if (!surveyColumns.some((column) => column.name === 'identity_mode')) {
  db.exec(
    "ALTER TABLE surveys ADD COLUMN identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden'))"
  )
}

db.exec(`
  CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    survey_title TEXT NOT NULL,
    survey_type TEXT NOT NULL CHECK(survey_type IN ('onboarding', 'offboarding')),
    respondent_name TEXT NOT NULL,
    respondent_email TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
  );
`)

function hydrateSurvey(row: any): Survey {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    identity_mode: row.identity_mode ?? 'required',
    slug: row.slug,
    access_code: row.access_code,
    pages: JSON.parse(row.pages_json),
    questions: JSON.parse(row.questions_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function hydrateResponse(row: any): SurveyResponse {
  return {
    id: row.id,
    survey_id: row.survey_id,
    survey_title: row.survey_title,
    survey_type: row.survey_type,
    respondent_name: row.respondent_name,
    respondent_email: row.respondent_email,
    submitted_at: row.submitted_at,
    answers: JSON.parse(row.answers_json),
  }
}

export const repo = {
  listSurveys() {
    const rows = db
      .prepare('SELECT * FROM surveys ORDER BY updated_at DESC')
      .all() as any[]
    return rows.map(hydrateSurvey)
  },
  getSurvey(id: string) {
    const row = db.prepare('SELECT * FROM surveys WHERE id = ?').get(id) as any
    return row ? hydrateSurvey(row) : null
  },
  getSurveyBySlugAndCode(slug: string, code: string) {
    const row = db
      .prepare('SELECT * FROM surveys WHERE slug = ? AND access_code = ? AND status = ?')
      .get(slug, code, 'published') as any
    return row ? hydrateSurvey(row) : null
  },
  createSurvey(input: Omit<Survey, 'id' | 'created_at' | 'updated_at'>) {
    const payload: Survey = {
      ...input,
      id: nanoid(10),
      created_at: now(),
      updated_at: now(),
    }

    db.prepare(
      `INSERT INTO surveys (id, title, description, type, status, identity_mode, slug, access_code, pages_json, questions_json, created_at, updated_at)
       VALUES (@id, @title, @description, @type, @status, @identity_mode, @slug, @access_code, @pages_json, @questions_json, @created_at, @updated_at)`
    ).run({
      ...payload,
      pages_json: JSON.stringify(payload.pages),
      questions_json: JSON.stringify(payload.questions),
    })

    return payload
  },
  updateSurvey(id: string, input: Omit<Survey, 'id' | 'created_at' | 'updated_at'>) {
    const current = this.getSurvey(id)
    if (!current) {
      return null
    }

    const updated: Survey = {
      ...current,
      ...input,
      id,
      updated_at: now(),
    }

    db.prepare(
      `UPDATE surveys
       SET title = @title,
           description = @description,
           type = @type,
           status = @status,
           identity_mode = @identity_mode,
           slug = @slug,
           access_code = @access_code,
           pages_json = @pages_json,
           questions_json = @questions_json,
           updated_at = @updated_at
       WHERE id = @id`
    ).run({
      ...updated,
      pages_json: JSON.stringify(updated.pages),
      questions_json: JSON.stringify(updated.questions),
    })

    return updated
  },
  deleteSurvey(id: string) {
    const survey = this.getSurvey(id)
    if (!survey) {
      return false
    }

    db.prepare('DELETE FROM survey_responses WHERE survey_id = ?').run(id)
    db.prepare('DELETE FROM surveys WHERE id = ?').run(id)
    return true
  },
  listResponses(filters: {
    search?: string
    type?: string
    surveyId?: string
  }) {
    const clauses: string[] = []
    const values: any[] = []

    if (filters.search) {
      clauses.push('(respondent_name LIKE ? OR respondent_email LIKE ?)')
      values.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters.type && filters.type !== 'all') {
      clauses.push('survey_type = ?')
      values.push(filters.type)
    }
    if (filters.surveyId && filters.surveyId !== 'all') {
      clauses.push('survey_id = ?')
      values.push(filters.surveyId)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = db
      .prepare(`SELECT * FROM survey_responses ${where} ORDER BY submitted_at DESC`)
      .all(...values) as any[]
    return rows.map(hydrateResponse)
  },
  createResponse(input: Omit<SurveyResponse, 'id' | 'submitted_at'>) {
    const payload: SurveyResponse = {
      ...input,
      id: nanoid(12),
      submitted_at: now(),
    }

    db.prepare(
      `INSERT INTO survey_responses
       (id, survey_id, survey_title, survey_type, respondent_name, respondent_email, submitted_at, answers_json)
       VALUES (@id, @survey_id, @survey_title, @survey_type, @respondent_name, @respondent_email, @submitted_at, @answers_json)`
    ).run({
      ...payload,
      answers_json: JSON.stringify(payload.answers),
    })

    return payload
  },
  getResponse(id: string) {
    const row = db
      .prepare('SELECT * FROM survey_responses WHERE id = ?')
      .get(id) as any
    return row ? hydrateResponse(row) : null
  },
  getSurveyResponses(surveyId: string) {
    const rows = db
      .prepare(
        'SELECT * FROM survey_responses WHERE survey_id = ? ORDER BY submitted_at DESC'
      )
      .all(surveyId) as any[]
    return rows.map(hydrateResponse)
  },
}

function seed() {
  const hasData = db.prepare('SELECT COUNT(*) as count FROM surveys').get() as {
    count: number
  }
  if (hasData.count > 0) {
    return
  }

  const onboarding = repo.createSurvey({
    title: 'New Employee Onboarding',
    description: 'Understand the first-week onboarding experience.',
    type: 'onboarding',
    status: 'published',
    identity_mode: 'required',
    slug: 'new-employee-onboarding',
    access_code: 'HR2026ON',
    pages: [
      { id: 'p1', title: 'Welcome', description: 'First impressions', order: 1 },
      { id: 'p2', title: 'Resources', description: 'Tools and support', order: 2 },
    ],
    questions: [
      {
        id: 'q1',
        page_id: 'p1',
        order: 1,
        type: 'rating',
        text: 'How clear was your onboarding process?',
        required: true,
      },
      {
        id: 'q2',
        page_id: 'p1',
        order: 2,
        type: 'yes_no',
        text: 'Did you receive your equipment on day one?',
        required: true,
      },
      {
        id: 'q3',
        page_id: 'p2',
        order: 1,
        type: 'text',
        text: 'What would improve your first two weeks?',
        required: false,
      },
    ],
  })

  const offboarding = repo.createSurvey({
    title: 'Employee Offboarding',
    description: 'Collect feedback from departing employees.',
    type: 'offboarding',
    status: 'published',
    identity_mode: 'optional',
    slug: 'employee-offboarding',
    access_code: 'HR2026OFF',
    pages: [{ id: 'p1', title: 'Exit', description: 'Exit feedback', order: 1 }],
    questions: [
      {
        id: 'q1',
        page_id: 'p1',
        order: 1,
        type: 'single_choice',
        text: 'Primary reason for leaving?',
        required: true,
        options: ['Career growth', 'Compensation', 'Manager', 'Relocation'],
      },
      {
        id: 'q2',
        page_id: 'p1',
        order: 2,
        type: 'rating',
        text: 'How likely are you to recommend this company?',
        required: true,
      },
    ],
  })

  repo.createResponse({
    survey_id: onboarding.id,
    survey_title: onboarding.title,
    survey_type: onboarding.type,
    respondent_name: 'Alex Carter',
    respondent_email: 'alex.carter@contoso.com',
    answers: [
      {
        question_id: 'q1',
        question_text: 'How clear was your onboarding process?',
        question_type: 'rating',
        value_number: 4,
      },
      {
        question_id: 'q2',
        question_text: 'Did you receive your equipment on day one?',
        question_type: 'yes_no',
        value_text: 'yes',
      },
      {
        question_id: 'q3',
        question_text: 'What would improve your first two weeks?',
        question_type: 'text',
        value_text: 'A buddy schedule for week one.',
      },
    ],
  })

  repo.createResponse({
    survey_id: onboarding.id,
    survey_title: onboarding.title,
    survey_type: onboarding.type,
    respondent_name: 'Taylor Reed',
    respondent_email: 'taylor.reed@contoso.com',
    answers: [
      {
        question_id: 'q1',
        question_text: 'How clear was your onboarding process?',
        question_type: 'rating',
        value_number: 5,
      },
      {
        question_id: 'q2',
        question_text: 'Did you receive your equipment on day one?',
        question_type: 'yes_no',
        value_text: 'yes',
      },
      {
        question_id: 'q3',
        question_text: 'What would improve your first two weeks?',
        question_type: 'text',
        value_text: 'More architecture docs.',
      },
    ],
  })

  repo.createResponse({
    survey_id: onboarding.id,
    survey_title: onboarding.title,
    survey_type: onboarding.type,
    respondent_name: 'Jordan Lee',
    respondent_email: 'jordan.lee@contoso.com',
    answers: [
      {
        question_id: 'q1',
        question_text: 'How clear was your onboarding process?',
        question_type: 'rating',
        value_number: 3,
      },
      {
        question_id: 'q2',
        question_text: 'Did you receive your equipment on day one?',
        question_type: 'yes_no',
        value_text: 'no',
      },
      {
        question_id: 'q3',
        question_text: 'What would improve your first two weeks?',
        question_type: 'text',
        value_text: 'Earlier system access.',
      },
    ],
  })

  repo.createResponse({
    survey_id: offboarding.id,
    survey_title: offboarding.title,
    survey_type: offboarding.type,
    respondent_name: 'Morgan Smith',
    respondent_email: 'morgan.smith@contoso.com',
    answers: [
      {
        question_id: 'q1',
        question_text: 'Primary reason for leaving?',
        question_type: 'single_choice',
        value_text: 'Career growth',
      },
      {
        question_id: 'q2',
        question_text: 'How likely are you to recommend this company?',
        question_type: 'rating',
        value_number: 2,
      },
    ],
  })
}

seed()
