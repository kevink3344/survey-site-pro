import type {
  DashboardPayload,
  SeedSummary,
  Survey,
  SurveyTemplate,
  SurveyResponse,
  SurveyResultsPayload,
  SurveyVersion,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function withBase(path: string) {
  return `${API_BASE}${path}`
}

export function getApiUrl(path: string) {
  return withBase(path)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBase(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  getDashboard: () => request<DashboardPayload>('/api/dashboard'),
  seedDemoData: () => request<SeedSummary>('/api/admin/seed', { method: 'POST' }),
  seedRecentResponsesOnly: () =>
    request<SeedSummary>('/api/admin/seed/responses', { method: 'POST' }),
  listSurveys: () => request<Survey[]>('/api/surveys'),
  getSurvey: (id: string) => request<Survey>(`/api/surveys/${id}`),
  createSurvey: (payload: Omit<Survey, 'id' | 'created_at' | 'updated_at'>) =>
    request<Survey>('/api/surveys', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSurvey: (id: string, payload: Omit<Survey, 'id' | 'created_at' | 'updated_at'>) =>
    request<Survey>(`/api/surveys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleSurveyStatus: (id: string) =>
    request<Survey>(`/api/surveys/${id}/status`, { method: 'PATCH' }),
  deleteSurvey: (id: string) =>
    request<void>(`/api/surveys/${id}`, {
      method: 'DELETE',
    }),
  rotateAccessCode: (id: string) =>
    request<Survey>(`/api/surveys/${id}/copy-url`, { method: 'POST' }),
  listResponses: (query: { search?: string; type?: string; surveyId?: string }) => {
    const params = new URLSearchParams()
    if (query.search) params.set('search', query.search)
    if (query.type) params.set('type', query.type)
    if (query.surveyId) params.set('surveyId', query.surveyId)
    const suffix = params.size > 0 ? `?${params}` : ''
    return request<SurveyResponse[]>(`/api/responses${suffix}`)
  },
  getSurveyResults: (id: string) =>
    request<SurveyResultsPayload>(`/api/surveys/${id}/results`),
  listSurveyVersions: (id: string) =>
    request<SurveyVersion[]>(`/api/surveys/${id}/versions`),
  listTemplates: () => request<SurveyTemplate[]>('/api/templates'),
  createTemplate: (payload: Omit<SurveyTemplate, 'id' | 'created_at' | 'updated_at'>) =>
    request<SurveyTemplate>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTemplate: (
    id: string,
    payload: Omit<SurveyTemplate, 'id' | 'created_at' | 'updated_at'>
  ) =>
    request<SurveyTemplate>(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteTemplate: (id: string) =>
    request<void>(`/api/templates/${id}`, {
      method: 'DELETE',
    }),
  getPublicSurvey: (slug: string, code: string) =>
    request<Survey>(`/api/surveys/slug/${slug}/${code}`),
  submitPublicResponse: (
    surveyId: string,
    payload: {
      respondent_name: string
      respondent_email: string
      answers: SurveyResponse['answers']
    }
  ) =>
    request<SurveyResponse>(`/api/surveys/${surveyId}/responses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
