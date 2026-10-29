import { useEffect, useState } from 'react'
import type { ToastNotification } from '../hooks/useToast'

type ToastProps = {
  notification: ToastNotification
  onDismiss: (id: number) => void
}

const labels = {
  ar: { success: 'تم بنجاح', error: 'حدث خطأ', info: 'تنبيه', close: 'إغلاق الإشعار' },
  en: { success: 'Success', error: 'Error', info: 'Information', close: 'Dismiss notification' },
}

export default function Toast({ notification, onDismiss }: ToastProps) {
  const { id, message, variant, language } = notification
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const duration = variant === 'error' ? 8000 : 5000

  useEffect(() => {
    const onVisibilityChange = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (hovered || focused || hidden) return
    const timeout = window.setTimeout(() => onDismiss(id), duration)
    return () => window.clearTimeout(timeout)
  }, [id, onDismiss, duration, hovered, focused, hidden])

  return (
    <li
      className={`toast toast--${variant}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      lang={language}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <span className="toast-icon" aria-hidden="true">
        {variant === 'success' ? '✓' : variant === 'error' ? '!' : 'i'}
      </span>
      <div className="toast-content">
        <strong>{labels[language][variant]}</strong>
        <p dir="auto">{message}</p>
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label={labels[language].close}
        onClick={() => onDismiss(id)}
      >
        ×
      </button>
    </li>
  )
}
