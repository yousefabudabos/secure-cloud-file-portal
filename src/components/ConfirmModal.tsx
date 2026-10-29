import type { ReactNode } from 'react'

type ConfirmModalProps = {
  message: string
  onConfirm: () => Promise<void>
  children: ReactNode
  className: string
  disabled?: boolean
  canConfirm: boolean
}

// Preserve the existing native confirmation dialog and trigger-button markup.
export default function ConfirmModal({
  message,
  onConfirm,
  children,
  className,
  disabled,
  canConfirm,
}: ConfirmModalProps) {
  return (
    <button
      className={className}
      onClick={() => {
        if (canConfirm && window.confirm(message)) {
          void onConfirm()
        }
      }}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
