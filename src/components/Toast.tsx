type ToastProps = {
  message: string
  variant?: 'success' | 'error' | 'external-message'
}

// Existing notices stay inline, with the same CSS classes and lifetime.
export default function Toast({ message, variant }: ToastProps) {
  if (!message) {
    return null
  }

  return (
    <div className={variant ? `notice ${variant}` : 'notice'}>
      {message}
    </div>
  )
}
