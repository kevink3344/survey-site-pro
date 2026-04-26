import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
const configuredDbPath = process.env.SURVEY_DB_PATH ?? process.env.SQLITE_DB_PATH;
const dbPath = configuredDbPath || join(process.cwd(), 'server', 'data', 'survey.sqlite');
const dbDir = dirname(dbPath);
if (dbDir) {
    mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);
const now = () => new Date().toISOString();
db.exec(`
  CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    cover_image_url TEXT NOT NULL DEFAULT '',
    cover_image_alt TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding', 'general')),
    status TEXT NOT NULL CHECK(status IN ('published', 'unpublished')),
    identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
    slug TEXT NOT NULL,
    access_code TEXT NOT NULL,
    pages_json TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
const surveyColumns = db.prepare('PRAGMA table_info(surveys)').all();
if (!surveyColumns.some((column) => column.name === 'identity_mode')) {
    db.exec("ALTER TABLE surveys ADD COLUMN identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden'))");
}
if (!surveyColumns.some((column) => column.name === 'cover_image_url')) {
    db.exec("ALTER TABLE surveys ADD COLUMN cover_image_url TEXT NOT NULL DEFAULT ''");
}
if (!surveyColumns.some((column) => column.name === 'cover_image_alt')) {
    db.exec("ALTER TABLE surveys ADD COLUMN cover_image_alt TEXT NOT NULL DEFAULT ''");
}
db.exec(`
  CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    survey_version_id TEXT,
    survey_title TEXT NOT NULL,
    survey_type TEXT NOT NULL CHECK(survey_type IN ('onboarding', 'offboarding', 'general')),
    respondent_name TEXT NOT NULL,
    respondent_email TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS survey_drafts (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    survey_version_id TEXT,
    resume_token TEXT NOT NULL UNIQUE,
    respondent_name TEXT NOT NULL,
    respondent_email TEXT NOT NULL,
    current_stage TEXT NOT NULL CHECK(current_stage IN ('intro', 'questions', 'review')),
    current_page_index INTEGER NOT NULL DEFAULT 0,
    answers_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
db.prepare(`INSERT INTO app_settings (key, value, updated_at)
   VALUES ('save_resume_enabled', 'true', @updated_at)
   ON CONFLICT(key) DO NOTHING`).run({ updated_at: now() });
db.prepare(`INSERT INTO app_settings (key, value, updated_at)
   VALUES ('autosave_timeout_ms', '60000', @updated_at)
   ON CONFLICT(key) DO NOTHING`).run({ updated_at: now() });
const surveyResponseColumns = db.prepare('PRAGMA table_info(survey_responses)').all();
if (!surveyResponseColumns.some((column) => column.name === 'survey_version_id')) {
    db.exec('ALTER TABLE survey_responses ADD COLUMN survey_version_id TEXT');
}
db.exec(`
  CREATE TABLE IF NOT EXISTS survey_versions (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    cover_image_url TEXT NOT NULL DEFAULT '',
    cover_image_alt TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding', 'general')),
    identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
    slug TEXT NOT NULL,
    access_code TEXT NOT NULL,
    pages_json TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    UNIQUE (survey_id, version_number)
  );
`);
const surveyVersionColumns = db.prepare('PRAGMA table_info(survey_versions)').all();
if (!surveyVersionColumns.some((column) => column.name === 'cover_image_url')) {
    db.exec("ALTER TABLE survey_versions ADD COLUMN cover_image_url TEXT NOT NULL DEFAULT ''");
}
if (!surveyVersionColumns.some((column) => column.name === 'cover_image_alt')) {
    db.exec("ALTER TABLE survey_versions ADD COLUMN cover_image_alt TEXT NOT NULL DEFAULT ''");
}
db.exec(`
  CREATE TABLE IF NOT EXISTS survey_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    cover_image_url TEXT NOT NULL DEFAULT '',
    cover_image_alt TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding', 'general')),
    identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
    pages_json TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
const surveyTemplateColumns = db.prepare('PRAGMA table_info(survey_templates)').all();
if (!surveyTemplateColumns.some((column) => column.name === 'cover_image_url')) {
    db.exec("ALTER TABLE survey_templates ADD COLUMN cover_image_url TEXT NOT NULL DEFAULT ''");
}
if (!surveyTemplateColumns.some((column) => column.name === 'cover_image_alt')) {
    db.exec("ALTER TABLE survey_templates ADD COLUMN cover_image_alt TEXT NOT NULL DEFAULT ''");
}
function tableContainsGeneralConstraint(tableName) {
    const row = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(tableName);
    return (row?.sql ?? '').toLowerCase().includes("'general'");
}
function migrateTablesForGeneralSurveyType() {
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN');
        db.exec('ALTER TABLE surveys RENAME TO surveys_old');
        db.exec(`
      CREATE TABLE surveys (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        cover_image_url TEXT NOT NULL DEFAULT '',
        cover_image_alt TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding', 'general')),
        status TEXT NOT NULL CHECK(status IN ('published', 'unpublished')),
        identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
        slug TEXT NOT NULL,
        access_code TEXT NOT NULL,
        pages_json TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
        db.exec(`
      INSERT INTO surveys (id, title, description, cover_image_url, cover_image_alt, type, status, identity_mode, slug, access_code, pages_json, questions_json, created_at, updated_at)
      SELECT id, title, description, COALESCE(cover_image_url, ''), COALESCE(cover_image_alt, ''), type, status, COALESCE(identity_mode, 'required'), slug, access_code, pages_json, questions_json, created_at, updated_at
      FROM surveys_old;
    `);
        db.exec('ALTER TABLE survey_versions RENAME TO survey_versions_old');
        db.exec(`
      CREATE TABLE survey_versions (
        id TEXT PRIMARY KEY,
        survey_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        cover_image_url TEXT NOT NULL DEFAULT '',
        cover_image_alt TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding', 'general')),
        identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
        slug TEXT NOT NULL,
        access_code TEXT NOT NULL,
        pages_json TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
        UNIQUE (survey_id, version_number)
      );
    `);
        db.exec(`
      INSERT INTO survey_versions (id, survey_id, version_number, title, description, cover_image_url, cover_image_alt, type, identity_mode, slug, access_code, pages_json, questions_json, published_at, created_at)
      SELECT id, survey_id, version_number, title, description, COALESCE(cover_image_url, ''), COALESCE(cover_image_alt, ''), type, COALESCE(identity_mode, 'required'), slug, access_code, pages_json, questions_json, published_at, created_at
      FROM survey_versions_old;
    `);
        db.exec('ALTER TABLE survey_responses RENAME TO survey_responses_old');
        db.exec(`
      CREATE TABLE survey_responses (
        id TEXT PRIMARY KEY,
        survey_id TEXT NOT NULL,
        survey_version_id TEXT,
        survey_title TEXT NOT NULL,
        survey_type TEXT NOT NULL CHECK(survey_type IN ('onboarding', 'offboarding', 'general')),
        respondent_name TEXT NOT NULL,
        respondent_email TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
      );
    `);
        db.exec(`
      INSERT INTO survey_responses (id, survey_id, survey_version_id, survey_title, survey_type, respondent_name, respondent_email, submitted_at, answers_json)
      SELECT id, survey_id, survey_version_id, survey_title, survey_type, respondent_name, respondent_email, submitted_at, answers_json
      FROM survey_responses_old;
    `);
        db.exec('ALTER TABLE survey_templates RENAME TO survey_templates_old');
        db.exec(`
      CREATE TABLE survey_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        cover_image_url TEXT NOT NULL DEFAULT '',
        cover_image_alt TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK(type IN ('onboarding', 'offboarding', 'general')),
        identity_mode TEXT NOT NULL DEFAULT 'required' CHECK(identity_mode IN ('required', 'optional', 'hidden')),
        pages_json TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
        db.exec(`
      INSERT INTO survey_templates (id, name, description, cover_image_url, cover_image_alt, type, identity_mode, pages_json, questions_json, created_at, updated_at)
      SELECT id, name, description, COALESCE(cover_image_url, ''), COALESCE(cover_image_alt, ''), type, COALESCE(identity_mode, 'required'), pages_json, questions_json, created_at, updated_at
      FROM survey_templates_old;
    `);
        db.exec('DROP TABLE surveys_old');
        db.exec('DROP TABLE survey_versions_old');
        db.exec('DROP TABLE survey_responses_old');
        db.exec('DROP TABLE survey_templates_old');
        db.exec('COMMIT');
    }
    catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}
if (!tableContainsGeneralConstraint('surveys') ||
    !tableContainsGeneralConstraint('survey_versions') ||
    !tableContainsGeneralConstraint('survey_responses') ||
    !tableContainsGeneralConstraint('survey_templates')) {
    migrateTablesForGeneralSurveyType();
}
function hydrateSurvey(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        cover_image_url: row.cover_image_url ?? '',
        cover_image_alt: row.cover_image_alt ?? '',
        type: row.type,
        status: row.status,
        identity_mode: row.identity_mode ?? 'required',
        slug: row.slug,
        access_code: row.access_code,
        pages: JSON.parse(row.pages_json),
        questions: JSON.parse(row.questions_json),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
function hydrateResponse(row) {
    return {
        id: row.id,
        survey_id: row.survey_id,
        survey_version_id: row.survey_version_id ?? null,
        survey_title: row.survey_title,
        survey_type: row.survey_type,
        respondent_name: row.respondent_name,
        respondent_email: row.respondent_email,
        submitted_at: row.submitted_at,
        answers: JSON.parse(row.answers_json),
    };
}
function hydrateSurveyDraft(row) {
    return {
        id: row.id,
        survey_id: row.survey_id,
        survey_version_id: row.survey_version_id ?? null,
        resume_token: row.resume_token,
        respondent_name: row.respondent_name,
        respondent_email: row.respondent_email,
        current_stage: row.current_stage,
        current_page_index: Number(row.current_page_index ?? 0),
        answers: JSON.parse(row.answers_json),
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
function hydrateSurveyVersion(row) {
    return {
        id: row.id,
        survey_id: row.survey_id,
        version_number: row.version_number,
        title: row.title,
        description: row.description,
        cover_image_url: row.cover_image_url ?? '',
        cover_image_alt: row.cover_image_alt ?? '',
        type: row.type,
        identity_mode: row.identity_mode ?? 'required',
        slug: row.slug,
        access_code: row.access_code,
        pages: JSON.parse(row.pages_json),
        questions: JSON.parse(row.questions_json),
        published_at: row.published_at,
        created_at: row.created_at,
    };
}
function hydrateSurveyTemplate(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        cover_image_url: row.cover_image_url ?? '',
        cover_image_alt: row.cover_image_alt ?? '',
        type: row.type,
        identity_mode: row.identity_mode ?? 'required',
        pages: JSON.parse(row.pages_json),
        questions: JSON.parse(row.questions_json),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
export const repo = {
    getAdminSettings() {
        const saveResumeRow = db
            .prepare("SELECT value FROM app_settings WHERE key = 'save_resume_enabled'")
            .get();
        const autosaveTimeoutRow = db
            .prepare("SELECT value FROM app_settings WHERE key = 'autosave_timeout_ms'")
            .get();
        return {
            save_resume_enabled: (saveResumeRow?.value ?? 'true') === 'true',
            autosave_timeout_ms: parseInt(autosaveTimeoutRow?.value ?? '60000', 10),
        };
    },
    updateAdminSettings(input) {
        db.prepare(`INSERT INTO app_settings (key, value, updated_at)
       VALUES ('save_resume_enabled', @value, @updated_at)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run({
            value: input.save_resume_enabled ? 'true' : 'false',
            updated_at: now(),
        });
        db.prepare(`INSERT INTO app_settings (key, value, updated_at)
       VALUES ('autosave_timeout_ms', @value, @updated_at)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run({
            value: input.autosave_timeout_ms.toString(),
            updated_at: now(),
        });
        return this.getAdminSettings();
    },
    listSurveys(filters) {
        let query = 'SELECT * FROM surveys';
        const values = [];
        if (filters?.search) {
            query += ' WHERE (title LIKE ? OR description LIKE ?)';
            values.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        query += ' ORDER BY updated_at DESC';
        const rows = db.prepare(query).all(...values);
        return rows.map(hydrateSurvey);
    },
    getSurvey(id) {
        const row = db.prepare('SELECT * FROM surveys WHERE id = ?').get(id);
        return row ? hydrateSurvey(row) : null;
    },
    getSurveyBySlugAndCode(slug, code) {
        const row = db
            .prepare('SELECT * FROM surveys WHERE slug = ? AND access_code = ? AND status = ?')
            .get(slug, code, 'published');
        return row ? hydrateSurvey(row) : null;
    },
    listSurveyVersions(surveyId) {
        const rows = db
            .prepare('SELECT * FROM survey_versions WHERE survey_id = ? ORDER BY version_number DESC')
            .all(surveyId);
        return rows.map(hydrateSurveyVersion);
    },
    getSurveyVersion(versionId) {
        const row = db
            .prepare('SELECT * FROM survey_versions WHERE id = ?')
            .get(versionId);
        return row ? hydrateSurveyVersion(row) : null;
    },
    getLatestSurveyVersionForSurvey(surveyId) {
        const row = db
            .prepare('SELECT * FROM survey_versions WHERE survey_id = ? ORDER BY version_number DESC LIMIT 1')
            .get(surveyId);
        return row ? hydrateSurveyVersion(row) : null;
    },
    createSurveyVersionFromSurvey(survey) {
        const latest = this.getLatestSurveyVersionForSurvey(survey.id);
        const versionNumber = (latest?.version_number ?? 0) + 1;
        const timestamp = now();
        const payload = {
            id: nanoid(12),
            survey_id: survey.id,
            version_number: versionNumber,
            title: survey.title,
            description: survey.description,
            cover_image_url: survey.cover_image_url,
            cover_image_alt: survey.cover_image_alt,
            type: survey.type,
            identity_mode: survey.identity_mode,
            slug: survey.slug,
            access_code: survey.access_code,
            pages: survey.pages,
            questions: survey.questions,
            published_at: timestamp,
            created_at: timestamp,
        };
        db.prepare(`INSERT INTO survey_versions
      (id, survey_id, version_number, title, description, cover_image_url, cover_image_alt, type, identity_mode, slug, access_code, pages_json, questions_json, published_at, created_at)
      VALUES (@id, @survey_id, @version_number, @title, @description, @cover_image_url, @cover_image_alt, @type, @identity_mode, @slug, @access_code, @pages_json, @questions_json, @published_at, @created_at)`).run({
            ...payload,
            pages_json: JSON.stringify(payload.pages),
            questions_json: JSON.stringify(payload.questions),
        });
        return payload;
    },
    listTemplates() {
        const rows = db
            .prepare('SELECT * FROM survey_templates ORDER BY updated_at DESC')
            .all();
        return rows.map(hydrateSurveyTemplate);
    },
    getTemplate(id) {
        const row = db
            .prepare('SELECT * FROM survey_templates WHERE id = ?')
            .get(id);
        return row ? hydrateSurveyTemplate(row) : null;
    },
    createTemplate(input) {
        const payload = {
            ...input,
            id: nanoid(10),
            created_at: now(),
            updated_at: now(),
        };
        db.prepare(`INSERT INTO survey_templates (id, name, description, cover_image_url, cover_image_alt, type, identity_mode, pages_json, questions_json, created_at, updated_at)
       VALUES (@id, @name, @description, @cover_image_url, @cover_image_alt, @type, @identity_mode, @pages_json, @questions_json, @created_at, @updated_at)`).run({
            ...payload,
            pages_json: JSON.stringify(payload.pages),
            questions_json: JSON.stringify(payload.questions),
        });
        return payload;
    },
    updateTemplate(id, input) {
        const current = this.getTemplate(id);
        if (!current) {
            return null;
        }
        const updated = {
            ...current,
            ...input,
            id,
            created_at: current.created_at,
            updated_at: now(),
        };
        db.prepare(`UPDATE survey_templates
       SET name = @name,
           description = @description,
           cover_image_url = @cover_image_url,
           cover_image_alt = @cover_image_alt,
           type = @type,
           identity_mode = @identity_mode,
           pages_json = @pages_json,
           questions_json = @questions_json,
           updated_at = @updated_at
       WHERE id = @id`).run({
            ...updated,
            pages_json: JSON.stringify(updated.pages),
            questions_json: JSON.stringify(updated.questions),
        });
        return updated;
    },
    deleteTemplate(id) {
        const info = db.prepare('DELETE FROM survey_templates WHERE id = ?').run(id);
        return info.changes > 0;
    },
    createSurvey(input) {
        const createdAt = input.created_at ?? now();
        const updatedAt = input.updated_at ?? createdAt;
        const payload = {
            ...input,
            id: nanoid(10),
            created_at: createdAt,
            updated_at: updatedAt,
        };
        db.prepare(`INSERT INTO surveys (id, title, description, cover_image_url, cover_image_alt, type, status, identity_mode, slug, access_code, pages_json, questions_json, created_at, updated_at)
       VALUES (@id, @title, @description, @cover_image_url, @cover_image_alt, @type, @status, @identity_mode, @slug, @access_code, @pages_json, @questions_json, @created_at, @updated_at)`).run({
            ...payload,
            pages_json: JSON.stringify(payload.pages),
            questions_json: JSON.stringify(payload.questions),
        });
        return payload;
    },
    updateSurvey(id, input) {
        const current = this.getSurvey(id);
        if (!current) {
            return null;
        }
        const updated = {
            ...current,
            ...input,
            id,
            updated_at: now(),
        };
        db.prepare(`UPDATE surveys
       SET title = @title,
           description = @description,
           cover_image_url = @cover_image_url,
           cover_image_alt = @cover_image_alt,
           type = @type,
           status = @status,
           identity_mode = @identity_mode,
           slug = @slug,
           access_code = @access_code,
           pages_json = @pages_json,
           questions_json = @questions_json,
           updated_at = @updated_at
       WHERE id = @id`).run({
            ...updated,
            pages_json: JSON.stringify(updated.pages),
            questions_json: JSON.stringify(updated.questions),
        });
        return updated;
    },
    deleteSurvey(id) {
        const survey = this.getSurvey(id);
        if (!survey) {
            return false;
        }
        db.prepare('DELETE FROM survey_drafts WHERE survey_id = ?').run(id);
        db.prepare('DELETE FROM survey_responses WHERE survey_id = ?').run(id);
        db.prepare('DELETE FROM survey_versions WHERE survey_id = ?').run(id);
        db.prepare('DELETE FROM surveys WHERE id = ?').run(id);
        return true;
    },
    listResponses(filters) {
        const clauses = [];
        const values = [];
        if (filters.search) {
            clauses.push('(respondent_name LIKE ? OR respondent_email LIKE ?)');
            values.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        if (filters.type && filters.type !== 'all') {
            clauses.push('survey_type = ?');
            values.push(filters.type);
        }
        if (filters.surveyId && filters.surveyId !== 'all') {
            clauses.push('survey_id = ?');
            values.push(filters.surveyId);
        }
        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        const rows = db
            .prepare(`SELECT * FROM survey_responses ${where} ORDER BY submitted_at DESC`)
            .all(...values);
        return rows.map(hydrateResponse);
    },
    createResponse(input) {
        const payload = {
            ...input,
            survey_version_id: input.survey_version_id ?? null,
            id: nanoid(12),
            submitted_at: input.submitted_at ?? now(),
        };
        db.prepare(`INSERT INTO survey_responses
       (id, survey_id, survey_version_id, survey_title, survey_type, respondent_name, respondent_email, submitted_at, answers_json)
       VALUES (@id, @survey_id, @survey_version_id, @survey_title, @survey_type, @respondent_name, @respondent_email, @submitted_at, @answers_json)`).run({
            ...payload,
            answers_json: JSON.stringify(payload.answers),
        });
        return payload;
    },
    getResponse(id) {
        const row = db
            .prepare('SELECT * FROM survey_responses WHERE id = ?')
            .get(id);
        return row ? hydrateResponse(row) : null;
    },
    getSurveyResponses(surveyId, surveyVersionId, includeLegacyUnversioned = false) {
        const rows = surveyVersionId
            ? db
                .prepare(includeLegacyUnversioned
                ? 'SELECT * FROM survey_responses WHERE survey_id = ? AND (survey_version_id = ? OR survey_version_id IS NULL) ORDER BY submitted_at DESC'
                : 'SELECT * FROM survey_responses WHERE survey_id = ? AND survey_version_id = ? ORDER BY submitted_at DESC')
                .all(surveyId, surveyVersionId)
            : db
                .prepare('SELECT * FROM survey_responses WHERE survey_id = ? ORDER BY submitted_at DESC')
                .all(surveyId);
        return rows.map(hydrateResponse);
    },
    getSurveyDraft(surveyId, resumeToken) {
        const row = db
            .prepare("SELECT * FROM survey_drafts WHERE survey_id = ? AND resume_token = ? AND status = 'draft'")
            .get(surveyId, resumeToken);
        return row ? hydrateSurveyDraft(row) : null;
    },
    createSurveyDraft(input) {
        const timestamp = now();
        const payload = {
            ...input,
            id: nanoid(12),
            resume_token: nanoid(32),
            status: 'draft',
            created_at: timestamp,
            updated_at: timestamp,
        };
        db.prepare(`INSERT INTO survey_drafts
       (id, survey_id, survey_version_id, resume_token, respondent_name, respondent_email, current_stage, current_page_index, answers_json, status, created_at, updated_at)
       VALUES (@id, @survey_id, @survey_version_id, @resume_token, @respondent_name, @respondent_email, @current_stage, @current_page_index, @answers_json, @status, @created_at, @updated_at)`).run({
            ...payload,
            answers_json: JSON.stringify(payload.answers),
        });
        return payload;
    },
    updateSurveyDraft(surveyId, resumeToken, input) {
        const existing = this.getSurveyDraft(surveyId, resumeToken);
        if (!existing) {
            return null;
        }
        const updated = {
            ...existing,
            survey_version_id: input.survey_version_id ?? existing.survey_version_id,
            respondent_name: input.respondent_name,
            respondent_email: input.respondent_email,
            current_stage: input.current_stage,
            current_page_index: input.current_page_index,
            answers: input.answers,
            updated_at: now(),
        };
        db.prepare(`UPDATE survey_drafts
       SET survey_version_id = @survey_version_id,
           respondent_name = @respondent_name,
           respondent_email = @respondent_email,
           current_stage = @current_stage,
           current_page_index = @current_page_index,
           answers_json = @answers_json,
           updated_at = @updated_at
       WHERE id = @id`).run({
            ...updated,
            answers_json: JSON.stringify(updated.answers),
        });
        return updated;
    },
    markSurveyDraftSubmitted(surveyId, resumeToken) {
        const existing = this.getSurveyDraft(surveyId, resumeToken);
        if (!existing) {
            return null;
        }
        db.prepare(`UPDATE survey_drafts
       SET status = 'submitted', updated_at = @updated_at
       WHERE id = @id`).run({
            id: existing.id,
            updated_at: now(),
        });
        return {
            ...existing,
            status: 'submitted',
            updated_at: now(),
        };
    },
};
function buildAnswersForSurvey(survey, index) {
    return survey.questions.map((question) => {
        if (question.type === 'rating') {
            return {
                question_id: question.id,
                question_text: question.text,
                question_type: question.type,
                value_number: 2 + (index % 4),
            };
        }
        if (question.type === 'yes_no') {
            return {
                question_id: question.id,
                question_text: question.text,
                question_type: question.type,
                value_text: index % 2 === 0 ? 'yes' : 'no',
            };
        }
        if (question.type === 'multiple_choice') {
            const options = question.options ?? [];
            return {
                question_id: question.id,
                question_text: question.text,
                question_type: question.type,
                value_array: options.length > 1 ? options.slice(0, 2) : options,
            };
        }
        if (question.type === 'single_choice') {
            const options = question.options ?? [];
            return {
                question_id: question.id,
                question_text: question.text,
                question_type: question.type,
                value_text: options[index % Math.max(options.length, 1)] ?? 'No answer',
            };
        }
        return {
            question_id: question.id,
            question_text: question.text,
            question_type: question.type,
            value_text: 'Synthetic response for dashboard trend testing.',
        };
    });
}
export function seedDemoData() {
    const suffix = nanoid(6).toLowerCase();
    const createdUsers = new Set();
    const daysAgoIso = (daysAgo) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        date.setHours(10, 0, 0, 0);
        return date.toISOString();
    };
    const onboarding = repo.createSurvey({
        title: `Onboarding Pulse ${suffix.toUpperCase()}`,
        description: 'Weekly onboarding pulse for new joiners.',
        cover_image_url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
        cover_image_alt: 'New employees collaborating in a bright office',
        type: 'onboarding',
        status: 'published',
        identity_mode: 'required',
        slug: `onboarding-pulse-${suffix}`,
        access_code: `ONB${suffix.toUpperCase()}`,
        created_at: daysAgoIso(12),
        updated_at: daysAgoIso(12),
        pages: [
            { id: 'p1', title: 'First Week', description: 'First-week feedback', order: 1 },
            { id: 'p2', title: 'Support', description: 'Support and resources', order: 2 },
        ],
        questions: [
            {
                id: 'q1',
                page_id: 'p1',
                order: 1,
                type: 'rating',
                text: 'How smooth was your first week?',
                required: true,
            },
            {
                id: 'q2',
                page_id: 'p1',
                order: 2,
                type: 'yes_no',
                text: 'Did your manager set clear goals?',
                required: true,
            },
            {
                id: 'q3',
                page_id: 'p2',
                order: 1,
                type: 'text',
                text: 'What would improve your onboarding?',
                required: false,
            },
        ],
    });
    const offboarding = repo.createSurvey({
        title: `Exit Experience ${suffix.toUpperCase()}`,
        description: 'Capture trends from departing employees.',
        cover_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
        cover_image_alt: 'Professional conversation during an exit interview',
        type: 'offboarding',
        status: 'published',
        identity_mode: 'optional',
        slug: `exit-experience-${suffix}`,
        access_code: `OFF${suffix.toUpperCase()}`,
        created_at: daysAgoIso(8),
        updated_at: daysAgoIso(8),
        pages: [{ id: 'p1', title: 'Exit Interview', description: 'Exit feedback', order: 1 }],
        questions: [
            {
                id: 'q1',
                page_id: 'p1',
                order: 1,
                type: 'single_choice',
                text: 'Primary reason for leaving?',
                required: true,
                options: ['Career growth', 'Compensation', 'Manager', 'Relocation', 'Workload'],
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
    });
    const general = repo.createSurvey({
        title: `Culture Pulse ${suffix.toUpperCase()}`,
        description: 'General organization-wide pulse check.',
        cover_image_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
        cover_image_alt: 'Team members in a group discussion with sticky notes',
        type: 'general',
        status: 'published',
        identity_mode: 'optional',
        slug: `culture-pulse-${suffix}`,
        access_code: `GEN${suffix.toUpperCase()}`,
        created_at: daysAgoIso(4),
        updated_at: daysAgoIso(4),
        pages: [{ id: 'p1', title: 'Culture & Engagement', description: 'Team and culture feedback', order: 1 }],
        questions: [
            {
                id: 'q1',
                page_id: 'p1',
                order: 1,
                type: 'rating',
                text: 'How would you rate team collaboration this month?',
                required: true,
            },
            {
                id: 'q2',
                page_id: 'p1',
                order: 2,
                type: 'multiple_choice',
                text: 'Which areas should we prioritize next quarter?',
                required: false,
                options: ['Communication', 'Recognition', 'Learning', 'Workload balance'],
            },
        ],
    });
    const respondentNames = [
        'Alex Carter',
        'Taylor Reed',
        'Jordan Lee',
        'Morgan Smith',
        'Casey Nguyen',
        'Riley Patel',
        'Avery Diaz',
        'Parker Kim',
        'Quinn Johnson',
        'Skyler Adams',
        'Drew Walker',
        'Blake Cooper',
        'Rowan Brooks',
        'Jamie Bennett',
    ];
    const reasons = ['Career growth', 'Compensation', 'Manager', 'Relocation', 'Workload'];
    let createdResponses = 0;
    for (let index = 0; index < 14; index += 1) {
        const day = new Date();
        day.setDate(day.getDate() - (13 - index));
        day.setHours(12, 0, 0, 0);
        const name = respondentNames[index % respondentNames.length];
        const email = `${name.toLowerCase().replace(/\s+/g, '.')}@contoso.com`;
        createdUsers.add(email);
        if (index % 3 === 0) {
            repo.createResponse({
                survey_id: onboarding.id,
                survey_title: onboarding.title,
                survey_type: onboarding.type,
                respondent_name: name,
                respondent_email: email,
                submitted_at: day.toISOString(),
                answers: [
                    {
                        question_id: 'q1',
                        question_text: 'How smooth was your first week?',
                        question_type: 'rating',
                        value_number: 3 + (index % 3),
                    },
                    {
                        question_id: 'q2',
                        question_text: 'Did your manager set clear goals?',
                        question_type: 'yes_no',
                        value_text: index % 4 === 0 ? 'yes' : 'no',
                    },
                    {
                        question_id: 'q3',
                        question_text: 'What would improve your onboarding?',
                        question_type: 'text',
                        value_text: 'More check-ins during week one.',
                    },
                ],
            });
        }
        else if (index % 3 === 1) {
            repo.createResponse({
                survey_id: offboarding.id,
                survey_title: offboarding.title,
                survey_type: offboarding.type,
                respondent_name: name,
                respondent_email: email,
                submitted_at: day.toISOString(),
                answers: [
                    {
                        question_id: 'q1',
                        question_text: 'Primary reason for leaving?',
                        question_type: 'single_choice',
                        value_text: reasons[index % reasons.length],
                    },
                    {
                        question_id: 'q2',
                        question_text: 'How likely are you to recommend this company?',
                        question_type: 'rating',
                        value_number: 2 + (index % 4),
                    },
                ],
            });
        }
        else {
            repo.createResponse({
                survey_id: general.id,
                survey_title: general.title,
                survey_type: general.type,
                respondent_name: name,
                respondent_email: email,
                submitted_at: day.toISOString(),
                answers: [
                    {
                        question_id: 'q1',
                        question_text: 'How would you rate team collaboration this month?',
                        question_type: 'rating',
                        value_number: 2 + (index % 4),
                    },
                    {
                        question_id: 'q2',
                        question_text: 'Which areas should we prioritize next quarter?',
                        question_type: 'multiple_choice',
                        value_array: ['Communication', 'Learning'],
                    },
                ],
            });
        }
        createdResponses += 1;
    }
    return {
        created_surveys: 3,
        created_users: createdUsers.size,
        created_responses: createdResponses,
    };
}
export function seedRecentResponsesOnly(days = 14, surveyId) {
    const surveys = repo
        .listSurveys()
        .filter((survey) => survey.status === 'published' &&
        survey.questions.length > 0 &&
        (!surveyId || survey.id === surveyId));
    if (surveys.length === 0 || days <= 0) {
        return {
            created_surveys: 0,
            created_users: 0,
            created_responses: 0,
        };
    }
    const createdUsers = new Set();
    let createdResponses = 0;
    const respondentNames = [
        'Alex Carter',
        'Taylor Reed',
        'Jordan Lee',
        'Morgan Smith',
        'Casey Nguyen',
        'Riley Patel',
        'Avery Diaz',
        'Parker Kim',
        'Quinn Johnson',
        'Skyler Adams',
        'Drew Walker',
        'Blake Cooper',
        'Rowan Brooks',
        'Jamie Bennett',
    ];
    for (let index = 0; index < days; index += 1) {
        const survey = surveys[index % surveys.length];
        const day = new Date();
        day.setDate(day.getDate() - (days - 1 - index));
        day.setHours(12, 0, 0, 0);
        const name = respondentNames[index % respondentNames.length];
        const email = `${name.toLowerCase().replace(/\s+/g, '.')}@contoso.com`;
        createdUsers.add(email);
        const version = survey.status === 'published'
            ? repo.getLatestSurveyVersionForSurvey(survey.id) ?? repo.createSurveyVersionFromSurvey(survey)
            : null;
        repo.createResponse({
            survey_id: survey.id,
            survey_version_id: version?.id ?? null,
            survey_title: survey.title,
            survey_type: survey.type,
            respondent_name: name,
            respondent_email: email,
            submitted_at: day.toISOString(),
            answers: buildAnswersForSurvey(survey, index),
        });
        createdResponses += 1;
    }
    return {
        created_surveys: 0,
        created_users: createdUsers.size,
        created_responses: createdResponses,
    };
}
function seed() {
    const hasData = db.prepare('SELECT COUNT(*) as count FROM surveys').get();
    if (hasData.count > 0) {
        return;
    }
    seedDemoData();
}
seed();
