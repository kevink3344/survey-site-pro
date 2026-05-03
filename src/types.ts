export type SurveyType = 'onboarding' | 'offboarding' | 'general'
export type SurveyStatus = 'published' | 'unpublished'
export type SurveyIdentityMode = 'required' | 'optional' | 'hidden'
export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'text'
  | 'multi_text'
  | 'rating'
  | 'yes_no'
  | 'attachment'
  | 'signature'
  | 'table'

export type TableColumnType = 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea'

export type SurveyTableColumn = {
  key: string
  label: string
  type: TableColumnType
  required: boolean
  options?: string[]
}

export type SurveyTableSchema = {
  title?: string
  columns: SurveyTableColumn[]
  min_rows: number
  max_rows: number
  allow_add_rows: boolean
  allow_delete_rows: boolean
  default_row_count: number
}

export type SurveyAttachmentValue = {
  name: string
  mime_type: string
  size_bytes: number
  data_url: string
}

export type SurveySignatureValue = {
  mime_type: 'image/png'
  data_url: string
  width: number
  height: number
  signed_at: string
}

export type BranchingRule = {
  value: string
  goToPageId: string
}

export type SurveyPage = {
  id: string
  title: string
  description?: string
  order: number
}

export type SurveyQuestion = {
  id: string
  page_id: string
  order: number
  type: QuestionType
  text: string
  required: boolean
  options?: string[]
  branching?: BranchingRule[]
  table_schema?: SurveyTableSchema
}

export type SurveyTableRow = Record<string, string | null>

export type Survey = {
  id: string
  title: string
  description: string
  cover_image_url: string
  cover_image_alt: string
  save_resume_enabled?: boolean
  autosave_timeout_ms?: number
  type: SurveyType
  status: SurveyStatus
  identity_mode: SurveyIdentityMode
  slug: string
  access_code: string
  pages: SurveyPage[]
  questions: SurveyQuestion[]
  created_at: string
  updated_at: string
  response_count?: number
  active_version_number?: number | null
}

export type SurveyVersion = {
  id: string
  survey_id: string
  version_number: number
  title: string
  description: string
  cover_image_url: string
  cover_image_alt: string
  type: SurveyType
  identity_mode: SurveyIdentityMode
  slug: string
  access_code: string
  pages: SurveyPage[]
  questions: SurveyQuestion[]
  published_at: string
  created_at: string
}

export type SurveyTemplate = {
  id: string
  name: string
  description: string
  cover_image_url: string
  cover_image_alt: string
  type: SurveyType
  identity_mode: SurveyIdentityMode
  pages: SurveyPage[]
  questions: SurveyQuestion[]
  created_at: string
  updated_at: string
}

export type SurveyAnswer = {
  question_id: string
  question_text: string
  question_type: QuestionType
  value_text?: string | null
  value_number?: number | null
  value_array?: string[] | null
  value_attachments?: SurveyAttachmentValue[] | null
  value_signature?: SurveySignatureValue | null
  value_table_rows?: SurveyTableRow[] | null
  other_text?: string | null
}

export type SurveyResponse = {
  id: string
  survey_id: string
  survey_version_id: string | null
  survey_title: string
  survey_type: SurveyType
  respondent_name: string
  respondent_email: string
  submitted_at: string
  answers: SurveyAnswer[]
}

export type SurveyDraftStage = 'intro' | 'questions' | 'review'

export type SurveyDraft = {
  id: string
  survey_id: string
  survey_version_id: string | null
  resume_token: string
  respondent_name: string
  respondent_email: string
  current_stage: SurveyDraftStage
  current_page_index: number
  answers: SurveyAnswer[]
  status: 'draft' | 'submitted'
  created_at: string
  updated_at: string
}

export type AdminSettings = {
  save_resume_enabled: boolean
  autosave_timeout_ms: number
  disclaimer_text: string
}

export type DashboardInsight = {
  id: string
  severity: 'positive' | 'warning' | 'info'
  title: string
  description: string
  metric?: string
  action?: {
    label: string
    to: string
  }
}

export type DashboardPayload = {
  stats: {
    total_surveys: number
    published_surveys: number
    onboarding_responses: number
    offboarding_responses: number
    general_responses: number
  }
  responses_last_14_days: Array<{ date: string; key: string; count: number }>
  responses_by_survey: Array<{ surveyId: string; title: string; responses: number }>
  daily_responses_by_survey: Record<string, Array<{ surveyId: string; title: string; responses: number }>>
  insights: DashboardInsight[]
  recent_surveys: Survey[]
}

export type SurveyResultsPayload = {
  survey: Survey
  survey_version?: SurveyVersion | null
  response_count: number
  questions: Array<
    | {
        question_id: string
        question_text: string
        question_type: 'rating'
        rating_average: number
        distribution: Array<{ label: string; count: number }>
      }
    | {
        question_id: string
        question_text: string
        question_type: 'text'
        texts: string[]
      }
    | {
        question_id: string
        question_text: string
        question_type: 'multi_text'
        texts: string[]
      }
    | {
        question_id: string
        question_text: string
        question_type: Exclude<QuestionType, 'rating' | 'text' | 'multi_text'>
        distribution: Array<{ label: string; count: number }>
      }
  >
  individual: SurveyResponse[]
}

export type SurveyTableDataPayload = {
  question_id: string
  question_text: string
  columns: SurveyTableColumn[]
  row_count: number
  rows: Array<Record<string, string>>
}

export type SeedSummary = {
  created_surveys: number
  created_users: number
  created_responses: number
}
