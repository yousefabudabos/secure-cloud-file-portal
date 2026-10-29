import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from '../hooks/useToast'
import type { ToastNotification, ToastOptions, ToastVariant } from '../hooks/useToast'
import Toast from './Toast'

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ToastNotification[]>([])
  const [polite, setPolite] = useState<ToastNotification | null>(null)
  const [assertive, setAssertive] = useState<ToastNotification | null>(null)
  const [reservedSpace, setReservedSpace] = useState(0)
  const nextId = useRef(0)
  const viewportRef = useRef<HTMLOListElement>(null)

  const notify = useCallback((
    message: string,
    variant: ToastVariant = 'info',
    options: ToastOptions = {},
  ) => {
    if (!message) return
    const notification = {
      id: ++nextId.current, message, variant, language: options.language ?? 'ar',
    }
    setNotifications((current) => [...current, notification].slice(-3))
    if (variant === 'error') setAssertive(notification)
    else setPolite(notification)
  }, [])

  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(() => {
      // Reserve scroll space beneath fixed notifications, including on mobile.
      setReservedSpace(viewport.childElementCount ? viewport.offsetHeight + 24 : 0)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      <div className="app-shell" style={{ paddingBlockEnd: reservedSpace }}>
        {children}
      </div>
      {createPortal(
        <>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {polite && <span key={polite.id} lang={polite.language}>{polite.message}</span>}
          </div>
          <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
            {assertive && <span key={assertive.id} lang={assertive.language}>{assertive.message}</span>}
          </div>
          <ol ref={viewportRef} className="toast-viewport" aria-label="الإشعارات" dir="rtl">
            {notifications.map((notification) => (
              <Toast key={notification.id} notification={notification} onDismiss={dismiss} />
            ))}
          </ol>
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
