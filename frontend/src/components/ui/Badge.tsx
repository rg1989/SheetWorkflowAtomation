import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200',
        {
          'bg-slate-100 text-slate-700': variant === 'default',
          'bg-emerald-100 text-emerald-700': variant === 'success',
          'bg-amber-100 text-amber-700': variant === 'warning',
          'bg-red-100 text-red-700': variant === 'error',
          'bg-blue-100 text-blue-700': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
