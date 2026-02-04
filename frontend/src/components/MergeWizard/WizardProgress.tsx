import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { WIZARD_STEPS } from '../../types/merge'

interface WizardProgressProps {
  currentStep: number
  onStepClick?: (step: number) => void
}

export function WizardProgress({ currentStep, onStepClick }: WizardProgressProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200" />
        
        {/* Animated progress line */}
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-primary-500"
          initial={{ width: '0%' }}
          animate={{
            width: `${(currentStep / (WIZARD_STEPS.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />

        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = onStepClick && index <= currentStep

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center z-10"
            >
              {/* Step circle */}
              <motion.button
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all duration-200',
                  isCompleted && 'bg-primary-500 text-white',
                  isCurrent && 'bg-primary-500 text-white ring-4 ring-primary-100',
                  !isCompleted && !isCurrent && 'bg-slate-100 text-slate-400',
                  isClickable && 'cursor-pointer hover:scale-105'
                )}
                whileHover={isClickable ? { scale: 1.05 } : undefined}
                whileTap={isClickable ? { scale: 0.95 } : undefined}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <Check className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <span>{index + 1}</span>
                )}
              </motion.button>

              {/* Step label */}
              <div className="mt-3 text-center">
                <p
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    isCurrent || isCompleted ? 'text-slate-900' : 'text-slate-400'
                  )}
                >
                  {step.title}
                </p>
                <p
                  className={cn(
                    'text-xs mt-0.5 transition-colors duration-200 max-w-[120px]',
                    isCurrent ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
