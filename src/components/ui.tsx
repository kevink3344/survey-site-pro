import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/helpers'

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('border border-border rounded-sm bg-card', className)}>{children}</div>
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <button
      className={cn(
        'h-9 px-3 rounded-sm text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'secondary' && 'border border-border bg-background text-foreground',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className
      )}
      {...props}
    />
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-primary',
        props.className
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-primary',
        props.className
      )}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary',
        props.className
      )}
    />
  )
}

export function Badge({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[3px] px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      {children}
    </span>
  )
}

export function Mono({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <span className={cn('font-mono tracking-tight', className)}>{children}</span>
}
