import type { SharedItem } from '../types'
import Toast from './Toast'

type SharedWithMeProps = {
  sharedFiles: SharedItem[]
  loadingShared: boolean
  sharedError: string
  onDownload: (file: SharedItem) => Promise<void>
}

export default function SharedWithMe({
  sharedFiles,
  loadingShared,
  sharedError,
  onDownload,
}: SharedWithMeProps) {
  return (
    <section
      id="shared-with-me"
      className="content-card"
    >
      <div className="section-header">
        <div>
          <span className="section-icon">↔</span>

          <div>
            <h2>تمت مشاركتها معي</h2>
            <p>
              الملفات التي شاركها معك موظفون آخرون
            </p>
          </div>
        </div>

        <span className="count-badge">
          {sharedFiles.length} ملف
        </span>
      </div>

      {loadingShared && (
        <div className="empty-state">
          جارٍ تحميل الملفات المشتركة...
        </div>
      )}

      {sharedError && (
        <Toast message={sharedError} variant="error" />
      )}

      {!loadingShared &&
        !sharedError &&
        sharedFiles.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">↔</div>
            <strong>
              لا توجد ملفات تمت مشاركتها معك
            </strong>
          </div>
        )}

      {sharedFiles.length > 0 && (
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>الملف</th>
                <th>تاريخ المشاركة</th>
                <th>الإجراء</th>
              </tr>
            </thead>

            <tbody>
              {sharedFiles.map((shared) => (
                <tr key={shared.shareId}>
                  <td>
                    <div className="file-cell">
                      <div className="file-icon">
                        SHR
                      </div>
                      <strong
                        className="bidi-safe"
                        dir="auto"
                      >
                        {shared.fileName}
                      </strong>
                    </div>
                  </td>

                  <td>
                    {new Date(
                      shared.createdAt,
                    ).toLocaleString('ar-LY')}
                  </td>

                  <td>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() =>
                        onDownload(shared)
                      }
                    >
                      تنزيل
                    </button>
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
