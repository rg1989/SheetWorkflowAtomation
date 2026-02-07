import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]',
          {
            'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm shadow-primary-600/25 hover:shadow-md hover:shadow-primary-600/30':
              variant === 'primary',
            'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-500':
              variant === 'secondary',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm shadow-red-600/25':
              variant === 'danger',
            'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:ring-slate-500':
              variant === 'ghost',
          },
          {
            'text-xs px-2.5 py-1.5': size === 'sm',
            'text-sm px-4 py-2.5': size === 'md',
            'text-base px-6 py-3': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
