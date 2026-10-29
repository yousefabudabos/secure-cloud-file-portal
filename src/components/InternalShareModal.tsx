import type { FileItem } from '../types'
import { getDisplayName } from '../utils/files'
import Toast from './Toast'

type InternalShareModalProps = {
  file: FileItem
  recipientEmail: string
  error: string
  isSharing: boolean
  onClose: () => void
  onSubmit: () => Promise<void>
  onRecipientEmailChange: (value: string) => void
}

export default function InternalShareModal({
  file,
  recipientEmail,
  error,
  isSharing,
  onClose,
  onSubmit,
  onRecipientEmailChange,
}: InternalShareModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="internal-share-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              مشاركة داخل الشركة
            </span>
            <h2 id="internal-share-title">
              مشاركة ملف مع موظف
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            disabled={isSharing}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        <div className="modal-file-card">
          <div className="file-icon">DOC</div>

          <div>
            <strong
              className="bidi-safe"
              dir="auto"
            >
              {getDisplayName(
                file.key,
              )}
            </strong>
            <span>
              سيتمكن الموظف من الوصول إلى الملف من
              قسم «تمت مشاركتها معي».
            </span>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <div className="form-group">
            <label htmlFor="internal-recipient-email">
              البريد الإلكتروني للموظف
            </label>

            <input
              id="internal-recipient-email"
              className="form-input"
              type="email"
              dir="ltr"
              autoFocus
              autoComplete="email"
              placeholder="employee@example.com"
              value={recipientEmail}
              onChange={(event) => {
                onRecipientEmailChange(event.target.value)
              }}
            />

            <small>
              يجب أن يكون المستلم مستخدمًا مسجلًا في
              بوابة الشركة.
            </small>
          </div>

          {error && (
            <Toast message={error} variant="error" />
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSharing}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSharing}
            >
              {isSharing
                ? 'جارٍ المشاركة...'
                : 'مشاركة الملف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
