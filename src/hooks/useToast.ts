import { createContext, useContext } from 'react'
import type { ExternalLanguage } from '../types'

export type ToastVariant = 'success' | 'error' | 'info'
export type ToastOptions = { language?: ExternalLanguage }
export type ToastNotification = {
  id: number
  message: string
  variant: ToastVariant
  language: ExternalLanguage
}

type ToastContextValue = {
  notify: (message: string, variant?: ToastVariant, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
