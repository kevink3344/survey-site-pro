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
