import type { FileItem } from '../types'
import { getDisplayName } from '../utils/files'
import Toast from './Toast'

type ExternalShareModalProps = {
  file: FileItem
  recipientEmail: string
  expiresInHours: string
  maxDownloads: string
  error: string
  isSharing: boolean
  onClose: () => void
  onSubmit: () => Promise<void>
  onRecipientEmailChange: (value: string) => void
  onExpiresInHoursChange: (value: string) => void
  onMaxDownloadsChange: (value: string) => void
}

export default function ExternalShareModal({
  file,
  recipientEmail,
  expiresInHours,
  maxDownloads,
  error,
  isSharing,
  onClose,
  onSubmit,
  onRecipientEmailChange,
  onExpiresInHoursChange,
  onMaxDownloadsChange,
}: ExternalShareModalProps) {
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
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-share-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              مشاركة خارج الشركة
            </span>
            <h2 id="external-share-title">
              إنشاء رابط مشاركة آمن
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
          <div className="file-icon">EXT</div>

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
              سيتم إنشاء رابط مؤقت يمكن إلغاؤه في أي
              وقت.
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
            <label htmlFor="external-recipient-email">
              بريد المستلم
              <span className="optional-label">
                اختياري
              </span>
            </label>

            <input
              id="external-recipient-email"
              className="form-input"
              type="email"
              dir="ltr"
              autoFocus
              autoComplete="email"
              placeholder="name@external-company.com"
              value={recipientEmail}
              onChange={(event) => {
                onRecipientEmailChange(event.target.value)
              }}
            />

            <small>
              هذا البريد للتوثيق فقط حاليًا. أرسل
              الرابط للمستلم بالطريقة المناسبة.
            </small>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="external-expiration">
                مدة صلاحية الرابط
              </label>

              <select
                id="external-expiration"
                className="form-input"
                value={expiresInHours}
                onChange={(event) =>
                  onExpiresInHoursChange(
                    event.target.value,
                  )
                }
              >
                <option value="1">ساعة واحدة</option>
                <option value="6">6 ساعات</option>
                <option value="24">24 ساعة</option>
                <option value="72">3 أيام</option>
                <option value="168">7 أيام</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="external-download-limit">
                الحد الأقصى للتنزيلات
              </label>

              <select
                id="external-download-limit"
                className="form-input"
                value={maxDownloads}
                onChange={(event) =>
                  onMaxDownloadsChange(
                    event.target.value,
                  )
                }
              >
                <option value="1">مرة واحدة</option>
                <option value="3">3 مرات</option>
                <option value="5">5 مرات</option>
                <option value="10">10 مرات</option>
                <option value="20">20 مرة</option>
              </select>
            </div>
          </div>

          <div className="modal-security-box">
            <strong>رابط آمن ومؤقت</strong>
            <span>
              لا يحتاج المستلم إلى حساب LISCO، ويمكنك
              إلغاء الرابط لاحقًا من قسم المشاركات
              الخارجية.
            </span>
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
                ? 'جارٍ إنشاء الرابط...'
                : 'إنشاء الرابط الآمن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
