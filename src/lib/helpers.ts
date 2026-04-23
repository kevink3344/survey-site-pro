import { clsx } from 'clsx'

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
