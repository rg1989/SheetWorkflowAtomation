import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

interface FileNamingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (fileName: string) => void
  defaultName: string
  actionLabel: string  // "Download" or "Export to Drive"
  isLoading?: boolean
}

export function FileNamingModal({
  isOpen,
  onClose,
  onConfirm,
  defaultName,
  actionLabel,
  isLoading = false,
}: FileNamingModalProps) {
  const [fileName, setFileName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update fileName when defaultName changes
  useEffect(() => {
    setFileName(defaultName)
  }, [defaultName])

  // Auto-select input text on mount
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.select()
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleConfirm = () => {
    if (fileName.trim()) {
      onConfirm(fileName.trim())
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const isDownload = actionLabel === 'Download'
  const extensionHint = isDownload ? '.xlsx' : 'Google Sheet'

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Name your file
            </h2>

            <Input
              ref={inputRef}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Enter file name"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && fileName.trim()) {
                  handleConfirm()
                }
              }}
            />

            <p className="text-xs text-slate-500 mt-2">
              {isDownload ? `File will be saved as: ${extensionHint}` : `Will create a new ${extensionHint}`}
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={!fileName.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    {actionLabel}ing...
                  </>
                ) : (
                  actionLabel
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
