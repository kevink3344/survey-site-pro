const PINNED_SURVEYS_KEY = 'pinnedSurveyIds'

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    if (!item.trim()) continue
    seen.add(item)
  }
  return Array.from(seen)
}

export function getPinnedSurveyIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_SURVEYS_KEY)
    if (!raw) return []
    return normalizeIds(JSON.parse(raw))
  } catch {
    return []
  }
}

export function setPinnedSurveyIds(ids: string[]) {
  localStorage.setItem(PINNED_SURVEYS_KEY, JSON.stringify(normalizeIds(ids)))
}

export function togglePinnedSurveyId(surveyId: string): boolean {
  const ids = getPinnedSurveyIds()
  if (ids.includes(surveyId)) {
    setPinnedSurveyIds(ids.filter((id) => id !== surveyId))
    return false
  }

  setPinnedSurveyIds([surveyId, ...ids])
  return true
}
