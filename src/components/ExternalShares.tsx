import { useToast } from '../hooks/useToast'
import type { ExternalShareItem } from '../types'
import ConfirmModal from './ConfirmModal'

type ExternalSharesProps = {
  externalShares: ExternalShareItem[]
  loadingExternalShares: boolean
  externalSharesError: string
  revokingExternalId: string
  canRevoke: boolean
  onRevoke: (shareId: string) => Promise<void>
}

export default function ExternalShares({
  externalShares,
  loadingExternalShares,
  externalSharesError,
  revokingExternalId,
  canRevoke,
  onRevoke,
}: ExternalSharesProps) {
  return (
    <section
      id="external-shares"
      className="content-card"
    >
      <div className="section-header">
        <div>
          <span className="section-icon">⌁</span>

          <div>
            <h2 tabIndex={-1}>المشاركات الخارجية</h2>
            <p>
              إدارة روابط الملفات التي شاركتها خارج الشركة
            </p>
          </div>
        </div>

        <span className="count-badge">
          {externalShares.length} رابط
        </span>
      </div>

      {loadingExternalShares && (
        <div className="empty-state">
          جارٍ تحميل المشاركات الخارجية...
        </div>
      )}

      {externalSharesError && (
        <div className="empty-state">{externalSharesError}</div>
      )}

      {!loadingExternalShares &&
        !externalSharesError &&
        externalShares.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">⌁</div>
            <strong>
              لا توجد روابط مشاركة خارجية
            </strong>
          </div>
        )}

      {externalShares.length > 0 && (
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>الملف</th>
                <th>المستلم</th>
                <th>الحالة</th>
                <th>التنزيلات</th>
                <th>تنتهي في</th>
                <th>الإجراء</th>
              </tr>
            </thead>

            <tbody>
              {externalShares.map((share) => (
                <tr key={share.shareId}>
                  <td>
                    <div className="file-cell">
                      <div className="file-icon">
                        EXT
                      </div>
                      <strong
                        className="bidi-safe"
                        dir="auto"
                      >
                        {share.fileName}
                      </strong>
                    </div>
                  </td>

                  <td>
                    <span
                      className="ltr-value"
                      dir="ltr"
                    >
                      {share.recipientEmail ||
                        'غير محدد'}
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        `status-badge status-${share.status}`
                      }
                    >
                      {share.status === 'active'
                        ? 'نشط'
                        : share.status === 'revoked'
                          ? 'ملغي'
                          : share.status === 'expired'
                            ? 'منتهي'
                            : 'وصل حد التنزيلات'}
                    </span>
                  </td>

                  <td>
                    {share.downloadCount}
                    {' / '}
                    {share.maxDownloads}
                  </td>

                  <td>
                    {new Date(
                      share.expiresAt * 1000,
                    ).toLocaleString('ar-LY')}
                  </td>

                  <td>
                    {share.status === 'active' ? (
                      <ConfirmModal
                        className="btn btn-small btn-danger-outline"
                        title="تأكيد إلغاء رابط المشاركة"
                        description="لن يتمكن المستلم من استخدام هذا الرابط بعد إلغائه. هل تريد المتابعة؟"
                        confirmLabel="إلغاء الرابط"
                        returnFocusTo="#external-shares h2"
                        canConfirm={canRevoke && Boolean(share.shareId)}
                        onConfirm={() => onRevoke(share.shareId)}
                        disabled={revokingExternalId === share.shareId}
                      >
                        {revokingExternalId ===
                        share.shareId
                          ? 'جارٍ الإلغاء...'
                          : 'إلغاء الرابط'}
                      </ConfirmModal>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

type ExternalShareLinkProps = {
  externalShareUrl: string
  externalShareId: string
  revokingExternalId: string
  canRevoke: boolean
  onRevoke: (shareId: string) => Promise<void>
}

export function ExternalShareLink({
  externalShareUrl,
  externalShareId,
  revokingExternalId,
  canRevoke,
  onRevoke,
}: ExternalShareLinkProps) {
  const { notify } = useToast()

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(externalShareUrl)
      notify('تم نسخ رابط المشاركة.', 'success')
    } catch {
      notify('تعذر نسخ الرابط. يمكنك نسخه من الحقل مباشرةً.', 'error')
    }
  }

  return (
    <section className="link-result-card">
      <div>
        <span className="eyebrow">
          رابط المشاركة الخارجية
        </span>

        <h3>تم إنشاء الرابط بنجاح</h3>

        <p>
          يمكنك نسخ الرابط وإرساله للجهة المستلمة.
        </p>
      </div>

      <div className="link-copy-row">
        <input
          value={externalShareUrl}
          readOnly
          aria-label="External sharing link"
        />

        <button
          className="btn btn-primary"
          onClick={copyLink}
        >
          نسخ الرابط
        </button>

        <a
          className="btn btn-secondary"
          href={externalShareUrl}
          target="_blank"
          rel="noreferrer"
        >
          فتح الرابط
        </a>
      </div>

      {externalShareId && (
        <ConfirmModal
          className="btn btn-danger-outline"
          title="تأكيد إلغاء رابط المشاركة"
          description="لن يتمكن المستلم من استخدام هذا الرابط بعد إلغائه. هل تريد المتابعة؟"
          confirmLabel="إلغاء الرابط"
          returnFocusTo="#external-shares h2"
          canConfirm={canRevoke && Boolean(externalShareId)}
          onConfirm={() => onRevoke(externalShareId)}
          disabled={revokingExternalId === externalShareId}
        >
          {revokingExternalId === externalShareId
            ? 'جارٍ الإلغاء...'
            : 'إلغاء مشاركة الرابط'}
        </ConfirmModal>
      )}
    </section>
  )
}
