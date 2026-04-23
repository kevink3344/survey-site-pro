export type SurveyType = 'onboarding' | 'offboarding'
export type SurveyStatus = 'published' | 'unpublished'
export type SurveyIdentityMode = 'required' | 'optional' | 'hidden'
export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'text'
  | 'rating'
  | 'yes_no'

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
}

export type Survey = {
  id: string
  title: string
  description: string
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
}

export type SurveyAnswer = {
  question_id: string
  question_text: string
  question_type: QuestionType
  value_text?: string | null
  value_number?: number | null
  value_array?: string[] | null
  other_text?: string | null
}

export type SurveyResponse = {
  id: string
  survey_id: string
  survey_title: string
  survey_type: SurveyType
  respondent_name: string
  respondent_email: string
  submitted_at: string
  answers: SurveyAnswer[]
}

export type DashboardPayload = {
  stats: {
    total_surveys: number
    published_surveys: number
    onboarding_responses: number
    offboarding_responses: number
  }
  responses_last_14_days: Array<{ date: string; key: string; count: number }>
  responses_by_survey: Array<{ surveyId: string; title: string; responses: number }>
  recent_surveys: Survey[]
}

export type SurveyResultsPayload = {
  survey: Survey
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
        question_type: Exclude<QuestionType, 'rating' | 'text'>
        distribution: Array<{ label: string; count: number }>
      }
  >
  individual: SurveyResponse[]
}
