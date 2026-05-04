import { clsx } from 'clsx'
import type { SurveyType } from '../types'

export const cn = (...values: Array<string | false | null | undefined>) => clsx(values)

export const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')

export const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value)
}

export const getSurveyTypeBadgeClass = (type: SurveyType) => {
  if (type === 'onboarding') return 'bg-primary/10 text-primary'
  if (type === 'offboarding') return 'bg-amber-500/10 text-amber-700'
  return 'bg-cyan-500/10 text-cyan-700'
}

export function toEmbedUrl(url: string): string {
  // Google Docs
  const docsMatch = url.match(/https:\/\/docs\.google\.com\/document\/d\/([^/?#]+)/)
  if (docsMatch) {
    return `https://docs.google.com/document/d/${docsMatch[1]}/preview`
  }

  // Google Slides
  const slidesMatch = url.match(/https:\/\/docs\.google\.com\/presentation\/d\/([^/?#]+)/)
  if (slidesMatch) {
    return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed`
  }

  // Google Sheets
  const sheetsMatch = url.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/?#]+)/)
  if (sheetsMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview`
  }

  // All other URLs (PDFs, etc.) — use as-is
  return url
}
