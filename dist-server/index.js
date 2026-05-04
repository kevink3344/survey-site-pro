import cors from 'cors';
import express from 'express';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { repo, seedDemoData, seedRecentResponsesOnly } from './db.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = join(__dirname, '..', 'dist');
const app = express();
const port = Number(process.env.PORT ?? 8787);
const pageSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional().default(''),
    order: z.number().int().nonnegative(),
});
const branchingRuleSchema = z.object({
    value: z.string().min(1),
    goToPageId: z.string().min(1),
});
const DATA_URL_PATTERN = /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i;
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,[a-z0-9+/=]+$/i;
const MAX_ATTACHMENT_FILES = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 7_500_000;
const MAX_SIGNATURE_DATA_URL_LENGTH = 500_000;
const tableColumnSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'email', 'number', 'date', 'select', 'textarea']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional().default([]),
});
const tableSchema = z.object({
    title: z.string().optional().default(''),
    columns: z.array(tableColumnSchema).min(1),
    min_rows: z.number().int().min(0).default(0),
    max_rows: z.number().int().min(1).default(25),
    allow_add_rows: z.boolean().default(true),
    allow_delete_rows: z.boolean().default(true),
    default_row_count: z.number().int().min(1).default(1),
});
const questionSchema = z.object({
    id: z.string().min(1),
    page_id: z.string().min(1),
    order: z.number().int().nonnegative(),
    type: z.enum([
        'single_choice',
        'multiple_choice',
        'text',
        'multi_text',
        'rating',
        'yes_no',
        'attachment',
        'signature',
        'table',
    ]),
    text: z.string().min(1),
    required: z.boolean(),
    options: z.array(z.string()).optional().default([]),
    branching: z.array(branchingRuleSchema).optional().default([]),
    table_schema: tableSchema.optional(),
});
const attachmentValueSchema = z.object({
    name: z.string().min(1).max(255),
    mime_type: z.string().min(3).max(120),
    size_bytes: z.number().int().min(1).max(MAX_ATTACHMENT_SIZE_BYTES),
    data_url: z.string().regex(DATA_URL_PATTERN).max(MAX_ATTACHMENT_DATA_URL_LENGTH),
});
const signatureValueSchema = z.object({
    mime_type: z.literal('image/png'),
    data_url: z.string().regex(PNG_DATA_URL_PATTERN).max(MAX_SIGNATURE_DATA_URL_LENGTH),
    width: z.number().int().min(120).max(2400),
    height: z.number().int().min(80).max(1200),
    signed_at: z.string().datetime(),
});
const surveySchema = z.object({
    title: z.string().min(1),
    description: z.string().default(''),
    cover_image_url: z.string().default(''),
    cover_image_alt: z.string().default(''),
    group_id: z.string().optional(),
    type: z.enum(['onboarding', 'offboarding', 'general']),
    status: z.enum(['published', 'unpublished']),
    identity_mode: z.enum(['required', 'optional', 'hidden']).default('required'),
    slug: z.string().min(1),
    access_code: z.string().min(1),
    pages: z.array(pageSchema).default([]),
    questions: z.array(questionSchema).default([]),
});
const templateSchema = z.object({
    name: z.string().min(1),
    description: z.string().default(''),
    cover_image_url: z.string().default(''),
    cover_image_alt: z.string().default(''),
    type: z.enum(['onboarding', 'offboarding', 'general']),
    identity_mode: z.enum(['required', 'optional', 'hidden']).default('required'),
    pages: z.array(pageSchema).default([]),
    questions: z.array(questionSchema).default([]),
});
const answerSchema = z.object({
    question_id: z.string(),
    question_text: z.string(),
    question_type: z.enum([
        'single_choice',
        'multiple_choice',
        'text',
        'multi_text',
        'rating',
        'yes_no',
        'attachment',
        'signature',
        'table',
    ]),
    value_text: z.string().nullable().optional(),
    value_number: z.number().nullable().optional(),
    value_array: z.array(z.string()).nullable().optional(),
    value_attachments: z.array(attachmentValueSchema).max(MAX_ATTACHMENT_FILES).nullable().optional(),
    value_signature: signatureValueSchema.nullable().optional(),
    value_table_rows: z.array(z.record(z.string(), z.union([z.string(), z.null()]))).nullable().optional(),
    other_text: z.string().nullable().optional(),
});
const createResponseSchema = z.object({
    respondent_name: z.string().optional().default(''),
    respondent_email: z.string().optional().default(''),
    answers: z.array(answerSchema).default([]),
});
const surveyDraftSchema = z.object({
    respondent_name: z.string().optional().default(''),
    respondent_email: z.string().optional().default(''),
    answers: z.array(answerSchema).default([]),
    current_stage: z.enum(['intro', 'questions', 'review']).default('intro'),
    current_page_index: z.number().int().min(0).default(0),
});
const adminSettingsSchema = z.object({
    save_resume_enabled: z.boolean(),
    autosave_timeout_ms: z.number().int().min(1000).max(300000).default(60000),
    disclaimer_text: z.string().default(''),
});
const groupSchema = z.object({
    name: z.string().trim().min(1).max(120),
});
function isSameVersionSnapshot(survey, version) {
    return (survey.title === version.title &&
        survey.description === version.description &&
        survey.cover_image_url === version.cover_image_url &&
        survey.cover_image_alt === version.cover_image_alt &&
        survey.type === version.type &&
        survey.identity_mode === version.identity_mode &&
        survey.slug === version.slug &&
        survey.access_code === version.access_code &&
        JSON.stringify(survey.pages) === JSON.stringify(version.pages) &&
        JSON.stringify(survey.questions) === JSON.stringify(version.questions));
}
function ensurePublishedVersion(survey, forceNew = false) {
    const latest = repo.getLatestSurveyVersionForSurvey(survey.id);
    if (!latest || forceNew || !isSameVersionSnapshot(survey, latest)) {
        return repo.createSurveyVersionFromSurvey(survey);
    }
    return latest;
}
function serializePublicSurvey(survey) {
    const version = repo.getLatestSurveyVersionForSurvey(survey.id);
    const settings = repo.getAdminSettings();
    if (!version) {
        return {
            ...survey,
            save_resume_enabled: settings.save_resume_enabled,
            autosave_timeout_ms: settings.autosave_timeout_ms,
        };
    }
    return {
        ...survey,
        title: version.title,
        description: version.description,
        cover_image_url: version.cover_image_url,
        cover_image_alt: version.cover_image_alt,
        type: version.type,
        identity_mode: version.identity_mode,
        slug: version.slug,
        access_code: version.access_code,
        pages: version.pages,
        questions: version.questions,
        active_version_number: version.version_number,
        save_resume_enabled: settings.save_resume_enabled,
        autosave_timeout_ms: settings.autosave_timeout_ms,
    };
}
function validateSurveySubmissionIdentity(survey, rawName, rawEmail) {
    if (survey.identity_mode === 'required' && (!rawName || !rawEmail)) {
        return 'Name and email are required for this survey.';
    }
    if (rawEmail && !z.string().email().safeParse(rawEmail).success) {
        return 'Please provide a valid email address.';
    }
    return null;
}
function createSurveyResponseForSurvey(survey, payload) {
    const rawName = (payload.respondent_name ?? '').trim();
    const rawEmail = (payload.respondent_email ?? '').trim();
    const validationError = validateSurveySubmissionIdentity(survey, rawName, rawEmail);
    if (validationError) {
        return {
            error: validationError,
            response: null,
        };
    }
    const respondentName = survey.identity_mode === 'hidden' ? '' : rawName;
    const respondentEmail = survey.identity_mode === 'hidden' ? '' : rawEmail;
    const surveyVersion = repo.getLatestSurveyVersionForSurvey(survey.id);
    const resolvedVersion = survey.status === 'published' ? surveyVersion ?? ensurePublishedVersion(survey) : null;
    const responseSurvey = resolvedVersion
        ? {
            ...survey,
            title: resolvedVersion.title,
            type: resolvedVersion.type,
        }
        : survey;
    return {
        error: null,
        response: repo.createResponse({
            survey_id: survey.id,
            survey_version_id: resolvedVersion?.id ?? null,
            survey_title: responseSurvey.title,
            survey_type: responseSurvey.type,
            respondent_name: respondentName,
            respondent_email: respondentEmail,
            answers: payload.answers,
        }),
    };
}
function requireSaveResumeEnabled(res, settings) {
    if (!settings.save_resume_enabled) {
        res.status(403).json({ error: 'Save and resume is currently disabled.' });
        return false;
    }
    return true;
}
function percentChange(current, previous) {
    if (previous <= 0) {
        return null;
    }
    return ((current - previous) / previous) * 100;
}
function isAnswerCompleted(answer) {
    if (!answer) {
        return false;
    }
    if (Array.isArray(answer.value_attachments)) {
        return answer.value_attachments.length > 0;
    }
    if (answer.value_signature && typeof answer.value_signature.data_url === 'string') {
        return answer.value_signature.data_url.trim().length > 0;
    }
    if (Array.isArray(answer.value_table_rows)) {
        return answer.value_table_rows.length > 0;
    }
    if (Array.isArray(answer.value_array)) {
        return answer.value_array.length > 0;
    }
    if (typeof answer.value_number === 'number') {
        return true;
    }
    if (typeof answer.value_text === 'string') {
        return answer.value_text.trim().length > 0;
    }
    return false;
}
function sanitizeSpreadsheetCell(value) {
    const trimmed = value.trimStart();
    if (!trimmed) {
        return value;
    }
    const firstChar = trimmed[0];
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
        return `'${value}`;
    }
    return value;
}
function csvEscape(value) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
}
function toCsv(headers, rows) {
    const lines = [];
    lines.push(headers.map((header) => csvEscape(header)).join(','));
    for (const row of rows) {
        lines.push(headers
            .map((header) => csvEscape(sanitizeSpreadsheetCell(row[header] ?? '')))
            .join(','));
    }
    return lines.join('\n');
}
function getSurveyShapeForResults(survey) {
    const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id);
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
        : survey;
    return { latestVersion, surveyShape };
}
function buildFlattenedTableRows(survey, questionId) {
    const { latestVersion, surveyShape } = getSurveyShapeForResults(survey);
    const question = surveyShape.questions.find((item) => item.id === questionId);
    if (!question) {
        return { latestVersion, surveyShape, question: null, rows: [] };
    }
    const columns = question.table_schema?.columns ?? [];
    const responses = latestVersion
        ? repo.getSurveyResponses(survey.id, latestVersion.id, true)
        : repo.getSurveyResponses(survey.id);
    const rows = [];
    for (const response of responses) {
        const answer = response.answers.find((item) => item.question_id === question.id);
        const tableRows = Array.isArray(answer?.value_table_rows) ? answer.value_table_rows : [];
        tableRows.forEach((row, rowIndex) => {
            const record = {
                response_id: response.id,
                submitted_at: response.submitted_at,
                respondent_name: response.respondent_name,
                respondent_email: response.respondent_email,
                survey_id: response.survey_id,
                question_id: question.id,
                row_index: String(rowIndex + 1),
            };
            for (const column of columns) {
                const header = column.label || column.key;
                const cell = row[column.key];
                record[header] = cell == null ? '' : String(cell);
            }
            rows.push(record);
        });
    }
    return { latestVersion, surveyShape, question, rows };
}
function shouldIncludeTableMetadata(value) {
    return value === '1' || value === 'true';
}
function resolveSurveyGroupId(rawGroupId) {
    if (typeof rawGroupId === 'string' && rawGroupId.trim().length > 0) {
        const group = repo.getGroup(rawGroupId);
        if (!group || !group.is_active) {
            return {
                error: 'Invalid target group selected.',
                groupId: null,
            };
        }
        return {
            error: null,
            groupId: group.id,
        };
    }
    const defaultGroup = repo.getDefaultGroup();
    if (!defaultGroup) {
        return {
            error: 'No active target groups are configured. Add one in Settings first.',
            groupId: null,
        };
    }
    return {
        error: null,
        groupId: defaultGroup.id,
    };
}
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
}
const openApiPath = join(__dirname, 'docs', 'openapi.yaml');
if (existsSync(openApiPath)) {
    const openApi = YAML.load(openApiPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi));
}
else {
    console.warn(`Using fallback OpenAPI docs: missing file at ${openApiPath}`);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup({
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
    }));
}
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});
app.get('/api/groups', (_req, res) => {
    res.json(repo.listGroups());
});
app.post('/api/groups', (req, res) => {
    const parsed = groupSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const created = repo.createGroup(parsed.data.name);
    res.status(201).json(created);
});
app.put('/api/groups/:id', (req, res) => {
    const parsed = groupSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const updated = repo.updateGroup(req.params.id, parsed.data.name);
    if (!updated) {
        res.status(404).json({ error: 'Group not found or name already exists.' });
        return;
    }
    res.json(updated);
});
app.delete('/api/groups/:id', (req, res) => {
    const group = repo.getGroup(req.params.id);
    if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
    }
    const defaultGroup = repo.getDefaultGroup();
    if (defaultGroup?.id === group.id) {
        res.status(400).json({ error: 'The default target group cannot be deleted.' });
        return;
    }
    const inUse = repo.countSurveysByGroup(group.id);
    if (inUse > 0) {
        res.status(400).json({ error: 'This group is assigned to one or more surveys.' });
        return;
    }
    repo.deleteGroup(group.id);
    res.status(204).send();
});
app.get('/api/admin/settings', (_req, res) => {
    res.json(repo.getAdminSettings());
});
app.patch('/api/admin/settings', (req, res) => {
    const parsed = adminSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    res.json(repo.updateAdminSettings(parsed.data));
});
app.post('/api/admin/seed', (_req, res) => {
    const result = seedDemoData();
    res.status(201).json(result);
});
app.post('/api/admin/seed/responses', (req, res) => {
    const surveyId = typeof req.body?.surveyId === 'string' ? req.body.surveyId : undefined;
    const result = seedRecentResponsesOnly(14, surveyId);
    res.status(201).json(result);
});
app.get('/api/dashboard', (_req, res) => {
    const surveys = repo.listSurveys();
    const responses = repo.listResponses({});
    const today = new Date();
    const lineSeries = Array.from({ length: 14 }).map((_, idx) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (13 - idx));
        const key = day.toISOString().slice(0, 10);
        return {
            date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            key,
            count: 0,
        };
    });
    for (const response of responses) {
        const key = response.submitted_at.slice(0, 10);
        const slot = lineSeries.find((item) => item.key === key);
        if (slot) {
            slot.count += 1;
        }
    }
    const responseBySurvey = surveys.map((survey) => ({
        surveyId: survey.id,
        title: survey.title,
        responses: responses.filter((r) => r.survey_id === survey.id).length,
    }));
    // Build per-day per-survey breakdown so the frontend can cross-filter
    const dailyBySurvey = {};
    for (const slot of lineSeries) {
        const dayResponses = responses.filter((r) => r.submitted_at.slice(0, 10) === slot.key);
        dailyBySurvey[slot.key] = surveys
            .map((survey) => ({
            surveyId: survey.id,
            title: survey.title,
            responses: dayResponses.filter((r) => r.survey_id === survey.id).length,
        }))
            .filter((s) => s.responses > 0);
    }
    const recentSurveys = surveys.slice(0, 5).map((survey) => ({
        ...survey,
        response_count: responses.filter((r) => r.survey_id === survey.id).length,
    }));
    const insights = [];
    const currentWeekResponses = lineSeries.slice(-7).reduce((sum, item) => sum + item.count, 0);
    const previousWeekResponses = lineSeries.slice(0, 7).reduce((sum, item) => sum + item.count, 0);
    const weekChange = percentChange(currentWeekResponses, previousWeekResponses);
    if (weekChange !== null) {
        if (weekChange <= -20) {
            insights.push({
                id: 'wow-drop',
                severity: 'warning',
                title: 'Responses dropped week-over-week',
                description: `Responses dropped ${Math.abs(weekChange).toFixed(0)}% vs last week.`,
                metric: `${currentWeekResponses} vs ${previousWeekResponses}`,
            });
        }
        else if (weekChange >= 20) {
            insights.push({
                id: 'wow-growth',
                severity: 'positive',
                title: 'Responses increased week-over-week',
                description: `Responses increased ${weekChange.toFixed(0)}% vs last week.`,
                metric: `${currentWeekResponses} vs ${previousWeekResponses}`,
            });
        }
    }
    const completionCandidates = [];
    for (const survey of surveys) {
        const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id);
        const surveyShape = latestVersion
            ? {
                ...survey,
                pages: latestVersion.pages,
                questions: latestVersion.questions,
            }
            : survey;
        const surveyResponses = latestVersion
            ? repo.getSurveyResponses(survey.id, latestVersion.id, true)
            : repo.getSurveyResponses(survey.id);
        if (surveyResponses.length < 8 || surveyShape.questions.length === 0) {
            continue;
        }
        const pageOrder = new Map([...surveyShape.pages]
            .sort((a, b) => a.order - b.order)
            .map((page, index) => [page.id, index]));
        const orderedQuestions = [...surveyShape.questions].sort((a, b) => {
            const pageDiff = (pageOrder.get(a.page_id) ?? 0) - (pageOrder.get(b.page_id) ?? 0);
            if (pageDiff !== 0) {
                return pageDiff;
            }
            return a.order - b.order;
        });
        orderedQuestions.forEach((question, index) => {
            const answered = surveyResponses.reduce((count, response) => {
                const answer = response.answers.find((item) => item.question_id === question.id);
                return count + (isAnswerCompleted(answer) ? 1 : 0);
            }, 0);
            const completionRate = answered / surveyResponses.length;
            completionCandidates.push({
                surveyId: survey.id,
                surveyTitle: surveyShape.title,
                questionText: question.text,
                completionRate,
                answered,
                total: surveyResponses.length,
                questionNumber: index + 1,
            });
        });
    }
    const lowestCompletionSnapshot = completionCandidates.sort((a, b) => a.completionRate - b.completionRate)[0];
    if (lowestCompletionSnapshot && lowestCompletionSnapshot.completionRate <= 0.65) {
        insights.push({
            id: 'low-question-completion',
            severity: 'warning',
            title: `Question ${lowestCompletionSnapshot.questionNumber} has unusually low completion`,
            description: `${lowestCompletionSnapshot.surveyTitle}: ${lowestCompletionSnapshot.questionText}`,
            metric: `${Math.round(lowestCompletionSnapshot.completionRate * 100)}% (${lowestCompletionSnapshot.answered}/${lowestCompletionSnapshot.total})`,
            action: {
                label: 'View Survey Results',
                to: `/surveys/${lowestCompletionSnapshot.surveyId}/results`,
            },
        });
    }
    if (insights.length === 0) {
        insights.push({
            id: 'stable-trend',
            severity: 'info',
            title: 'No major anomalies detected',
            description: 'Response volume and question completion look stable for the current dataset.',
        });
    }
    res.json({
        stats: {
            total_surveys: surveys.length,
            published_surveys: surveys.filter((s) => s.status === 'published').length,
            onboarding_responses: responses.filter((r) => r.survey_type === 'onboarding').length,
            offboarding_responses: responses.filter((r) => r.survey_type === 'offboarding').length,
            general_responses: responses.filter((r) => r.survey_type === 'general').length,
        },
        responses_last_14_days: lineSeries,
        responses_by_survey: responseBySurvey,
        daily_responses_by_survey: dailyBySurvey,
        insights,
        recent_surveys: recentSurveys,
    });
});
app.get('/api/surveys', (req, res) => {
    const surveys = repo.listSurveys({
        search: String(req.query.search ?? ''),
    });
    const responseCount = repo.listResponses({});
    res.json(surveys.map((survey) => ({
        ...survey,
        active_version_number: repo.getLatestSurveyVersionForSurvey(survey.id)?.version_number ?? null,
        response_count: responseCount.filter((r) => r.survey_id === survey.id).length,
    })));
});
app.post('/api/surveys', (req, res) => {
    const parsed = surveySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const groupResolution = resolveSurveyGroupId(parsed.data.group_id);
    if (groupResolution.error || !groupResolution.groupId) {
        res.status(400).json({ error: groupResolution.error ?? 'Invalid target group.' });
        return;
    }
    const created = repo.createSurvey({
        ...parsed.data,
        group_id: groupResolution.groupId,
    });
    if (created.status === 'published') {
        ensurePublishedVersion(created);
    }
    res.status(201).json(created);
});
app.get('/api/surveys/:id', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id);
    res.json({
        ...survey,
        active_version_number: latestVersion?.version_number ?? null,
    });
});
app.get('/api/surveys/:id/versions', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const versions = repo.listSurveyVersions(survey.id);
    res.json(versions);
});
app.put('/api/surveys/:id', (req, res) => {
    const parsed = surveySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const groupResolution = resolveSurveyGroupId(parsed.data.group_id);
    if (groupResolution.error || !groupResolution.groupId) {
        res.status(400).json({ error: groupResolution.error ?? 'Invalid target group.' });
        return;
    }
    const updated = repo.updateSurvey(req.params.id, {
        ...parsed.data,
        group_id: groupResolution.groupId,
    });
    if (!updated) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    if (updated.status === 'published') {
        ensurePublishedVersion(updated);
    }
    res.json(updated);
});
app.patch('/api/surveys/:id/status', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const nextStatus = survey.status === 'published' ? 'unpublished' : 'published';
    const updated = repo.updateSurvey(survey.id, {
        title: survey.title,
        description: survey.description,
        cover_image_url: survey.cover_image_url,
        cover_image_alt: survey.cover_image_alt,
        group_id: survey.group_id,
        type: survey.type,
        status: nextStatus,
        identity_mode: survey.identity_mode,
        slug: survey.slug,
        access_code: survey.access_code,
        pages: survey.pages,
        questions: survey.questions,
    });
    if (updated && nextStatus === 'published') {
        ensurePublishedVersion(updated, true);
    }
    res.json(updated);
});
app.delete('/api/surveys/:id', (req, res) => {
    const deleted = repo.deleteSurvey(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    res.status(204).send();
});
app.get('/api/surveys/slug/:slug/:code', (req, res) => {
    const survey = repo.getSurveyBySlugAndCode(req.params.slug, req.params.code);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found or unpublished' });
        return;
    }
    res.json(serializePublicSurvey(survey));
});
app.get('/api/surveys/:id/drafts/:token', (req, res) => {
    const settings = repo.getAdminSettings();
    if (!requireSaveResumeEnabled(res, settings)) {
        return;
    }
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const draft = repo.getSurveyDraft(survey.id, req.params.token);
    if (!draft) {
        res.status(404).json({ error: 'Draft not found' });
        return;
    }
    res.json(draft);
});
app.post('/api/surveys/:id/drafts', (req, res) => {
    const settings = repo.getAdminSettings();
    if (!requireSaveResumeEnabled(res, settings)) {
        return;
    }
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const parsed = surveyDraftSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id);
    const draft = repo.createSurveyDraft({
        survey_id: survey.id,
        survey_version_id: latestVersion?.id ?? null,
        respondent_name: parsed.data.respondent_name,
        respondent_email: parsed.data.respondent_email,
        current_stage: parsed.data.current_stage,
        current_page_index: parsed.data.current_page_index,
        answers: parsed.data.answers,
    });
    res.status(201).json(draft);
});
app.put('/api/surveys/:id/drafts/:token', (req, res) => {
    const settings = repo.getAdminSettings();
    if (!requireSaveResumeEnabled(res, settings)) {
        return;
    }
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const parsed = surveyDraftSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const latestVersion = repo.getLatestSurveyVersionForSurvey(survey.id);
    const draft = repo.updateSurveyDraft(survey.id, req.params.token, {
        survey_version_id: latestVersion?.id ?? null,
        respondent_name: parsed.data.respondent_name,
        respondent_email: parsed.data.respondent_email,
        current_stage: parsed.data.current_stage,
        current_page_index: parsed.data.current_page_index,
        answers: parsed.data.answers,
    });
    if (!draft) {
        res.status(404).json({ error: 'Draft not found' });
        return;
    }
    res.json(draft);
});
app.get('/api/templates', (_req, res) => {
    const templates = repo.listTemplates();
    res.json(templates);
});
app.post('/api/templates', (req, res) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const created = repo.createTemplate(parsed.data);
    res.status(201).json(created);
});
app.put('/api/templates/:id', (req, res) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const updated = repo.updateTemplate(req.params.id, parsed.data);
    if (!updated) {
        res.status(404).json({ error: 'Template not found' });
        return;
    }
    res.json(updated);
});
app.delete('/api/templates/:id', (req, res) => {
    const deleted = repo.deleteTemplate(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Template not found' });
        return;
    }
    res.status(204).send();
});
app.get('/api/responses', (req, res) => {
    const responses = repo.listResponses({
        search: String(req.query.search ?? ''),
        type: String(req.query.type ?? ''),
        surveyId: String(req.query.surveyId ?? ''),
    });
    res.json(responses);
});
app.get('/api/responses/:id', (req, res) => {
    const response = repo.getResponse(req.params.id);
    if (!response) {
        res.status(404).json({ error: 'Response not found' });
        return;
    }
    res.json(response);
});
app.post('/api/surveys/:id/responses', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const parsed = createResponseSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const result = createSurveyResponseForSurvey(survey, {
        respondent_name: parsed.data.respondent_name,
        respondent_email: parsed.data.respondent_email,
        answers: parsed.data.answers,
    });
    if (result.error || !result.response) {
        res.status(400).json({ error: result.error ?? 'Unable to submit response.' });
        return;
    }
    res.status(201).json(result.response);
});
app.post('/api/surveys/:id/drafts/:token/submit', (req, res) => {
    const settings = repo.getAdminSettings();
    if (!requireSaveResumeEnabled(res, settings)) {
        return;
    }
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const draft = repo.getSurveyDraft(survey.id, req.params.token);
    if (!draft) {
        res.status(404).json({ error: 'Draft not found' });
        return;
    }
    const result = createSurveyResponseForSurvey(survey, {
        respondent_name: draft.respondent_name,
        respondent_email: draft.respondent_email,
        answers: draft.answers,
    });
    if (result.error || !result.response) {
        res.status(400).json({ error: result.error ?? 'Unable to submit response.' });
        return;
    }
    repo.markSurveyDraftSubmitted(survey.id, req.params.token);
    res.status(201).json(result.response);
});
app.get('/api/surveys/:id/results', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const { latestVersion, surveyShape } = getSurveyShapeForResults(survey);
    const responses = latestVersion
        ? repo.getSurveyResponses(req.params.id, latestVersion.id, true)
        : repo.getSurveyResponses(req.params.id);
    const allResponses = repo.getSurveyResponses(req.params.id);
    const byQuestion = surveyShape.questions.map((q) => {
        const answers = responses
            .map((response) => response.answers.find((a) => a.question_id === q.id))
            .filter(Boolean);
        if (q.type === 'rating') {
            const values = answers
                .map((a) => a.value_number)
                .filter((v) => typeof v === 'number');
            const average = values.length
                ? values.reduce((sum, value) => sum + value, 0) / values.length
                : 0;
            return {
                question_id: q.id,
                question_text: q.text,
                question_type: q.type,
                rating_average: Number(average.toFixed(2)),
                distribution: [1, 2, 3, 4, 5].map((value) => ({
                    label: String(value),
                    count: values.filter((v) => v === value).length,
                })),
            };
        }
        if (q.type === 'text' || q.type === 'multi_text') {
            return {
                question_id: q.id,
                question_text: q.text,
                question_type: q.type,
                texts: answers
                    .map((a) => a.value_text)
                    .filter((v) => Boolean(v && v.trim())),
            };
        }
        if (q.type === 'attachment') {
            const withAttachments = answers.filter((answer) => Array.isArray(answer.value_attachments) && answer.value_attachments.length > 0).length;
            return {
                question_id: q.id,
                question_text: q.text,
                question_type: q.type,
                distribution: [
                    { label: 'Submitted attachment', count: withAttachments },
                    { label: 'No attachment', count: Math.max(answers.length - withAttachments, 0) },
                ],
            };
        }
        if (q.type === 'signature') {
            const signed = answers.filter((answer) => Boolean(answer.value_signature && answer.value_signature.data_url)).length;
            return {
                question_id: q.id,
                question_text: q.text,
                question_type: q.type,
                distribution: [
                    { label: 'Signed', count: signed },
                    { label: 'Not signed', count: Math.max(answers.length - signed, 0) },
                ],
            };
        }
        if (q.type === 'table') {
            const rowTally = new Map();
            for (const answer of answers) {
                const rowCount = Array.isArray(answer.value_table_rows) ? answer.value_table_rows.length : 0;
                const label = rowCount === 1 ? '1 row' : `${rowCount} rows`;
                rowTally.set(label, (rowTally.get(label) ?? 0) + 1);
            }
            return {
                question_id: q.id,
                question_text: q.text,
                question_type: q.type,
                distribution: Array.from(rowTally.entries()).map(([label, count]) => ({
                    label,
                    count,
                })),
            };
        }
        const tally = new Map();
        for (const answer of answers) {
            const values = answer.value_array && answer.value_array.length > 0
                ? answer.value_array
                : [answer.value_text ?? 'No answer'];
            for (const value of values) {
                const current = tally.get(value) ?? 0;
                tally.set(value, current + 1);
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
        };
    });
    res.json({
        survey: surveyShape,
        survey_version: latestVersion,
        response_count: allResponses.length,
        questions: byQuestion,
        individual: allResponses,
    });
});
app.get('/api/surveys/:id/questions/:questionId/table-rows', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const { question, rows } = buildFlattenedTableRows(survey, req.params.questionId);
    if (!question) {
        res.status(404).json({ error: 'Question not found for this survey.' });
        return;
    }
    if (question.type !== 'table') {
        res.status(400).json({ error: 'Table data is only available for table questions.' });
        return;
    }
    res.json({
        question_id: question.id,
        question_text: question.text,
        columns: question.table_schema?.columns ?? [],
        row_count: rows.length,
        rows,
    });
});
app.get('/api/surveys/:id/questions/:questionId/table-export.csv', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const { surveyShape, question, rows } = buildFlattenedTableRows(survey, req.params.questionId);
    if (!question) {
        res.status(404).json({ error: 'Question not found for this survey.' });
        return;
    }
    if (question.type !== 'table') {
        res.status(400).json({ error: 'CSV export is only available for table questions.' });
        return;
    }
    const columns = question.table_schema?.columns ?? [];
    if (columns.length === 0) {
        res.status(400).json({ error: 'Table schema has no columns.' });
        return;
    }
    const includeMetadata = shouldIncludeTableMetadata(req.query.includeMeta);
    const headers = [
        'row_index',
        ...(includeMetadata
            ? ['response_id', 'submitted_at', 'respondent_name', 'respondent_email', 'survey_id', 'question_id']
            : []),
        ...columns.map((column) => column.label || column.key),
    ];
    const csv = toCsv(headers, rows);
    const slug = `${surveyShape.title || 'survey'}-${question.text || 'table'}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug || 'table-export'}.csv"`);
    res.send(csv);
});
app.post('/api/surveys/:id/copy-url', (req, res) => {
    const survey = repo.getSurvey(req.params.id);
    if (!survey) {
        res.status(404).json({ error: 'Survey not found' });
        return;
    }
    const next = repo.updateSurvey(survey.id, {
        ...survey,
        access_code: nanoid(8).toUpperCase(),
    });
    res.json(next);
});
if (existsSync(clientDistPath)) {
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
        res.sendFile(join(clientDistPath, 'index.html'));
    });
}
app.listen(port, () => {
    console.log(`API server running on http://localhost:${port}`);
    console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
});
