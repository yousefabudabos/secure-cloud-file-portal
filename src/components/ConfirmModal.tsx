import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type ConfirmModalProps = {
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<void>
  children: ReactNode
  className: string
  disabled?: boolean
  canConfirm: boolean
  returnFocusTo: string
}

export default function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
  className,
  disabled,
  canConfirm,
  returnFocusTo,
}: ConfirmModalProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const [pending, setPending] = useState(false)

  const restoreFocus = () => {
    const trigger = triggerRef.current
    if (trigger?.isConnected && !trigger.disabled) {
      trigger.focus({ preventScroll: true })
    } else {
      document.querySelector<HTMLElement>(returnFocusTo)?.focus()
    }
  }

  const confirm = async () => {
    if (submitting.current || disabled || !canConfirm) return
    submitting.current = true
    setPending(true)
    const dialog = dialogRef.current
    dialog?.focus()
    try {
      await onConfirm()
    } finally {
      submitting.current = false
      setPending(false)
      dialog?.close()
      // The triggering row may have been removed by a successful operation.
      restoreFocus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        disabled={disabled || pending || !canConfirm}
        onClick={() => {
          dialogRef.current?.showModal()
          cancelRef.current?.focus()
        }}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        className="modal-card confirm-modal"
        dir="rtl"
        lang="ar"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={pending}
        tabIndex={-1}
        onCancel={(event) => {
          if (submitting.current) event.preventDefault()
        }}
        onClose={restoreFocus}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          if (submitting.current) {
            event.preventDefault()
            return
          }
          const first = cancelRef.current
          const last = disabled || !canConfirm ? first : confirmRef.current
          const active = document.activeElement
          if (event.shiftKey && (active === first || active === dialogRef.current)) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && (active === last || active === dialogRef.current)) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        <div className="confirm-icon" aria-hidden="true">!</div>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`} className="confirm-description">
          {description}
        </p>
        <p className="confirm-progress" role="status">
          {pending ? 'جارٍ تنفيذ الطلب، يرجى الانتظار…' : ''}
        </p>
        <div className="modal-actions confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            إلغاء
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-danger"
            disabled={pending || disabled || !canConfirm}
            onClick={() => { void confirm() }}
          >
            {pending ? 'جارٍ التنفيذ…' : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  )
}
