import type { FileItem } from '../types'
import { getDisplayName } from '../utils/files'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'

type MyFilesProps = {
  files: FileItem[]
  loadingFiles: boolean
  filesError: string
  sharingKey: string
  externalSharingKey: string
  deletingKey: string
  canDelete: boolean
  onDownload: (file: FileItem) => Promise<void>
  onInternalShare: (file: FileItem) => void
  onExternalShare: (file: FileItem) => void
  onDelete: (file: FileItem) => Promise<void>
}

export default function MyFiles({
  files,
  loadingFiles,
  filesError,
  sharingKey,
  externalSharingKey,
  deletingKey,
  canDelete,
  onDownload,
  onInternalShare,
  onExternalShare,
  onDelete,
}: MyFilesProps) {
  return (
    <section
      id="my-files"
      className="content-card"
    >
      <div className="section-header">
        <div>
          <span className="section-icon">▣</span>

          <div>
            <h2>ملفاتي</h2>
            <p>
              الملفات التي قمت برفعها إلى البوابة
            </p>
          </div>
        </div>

        <span className="count-badge">
          {files.length} ملف
        </span>
      </div>

      {loadingFiles && (
        <div className="empty-state">
          جارٍ تحميل الملفات...
        </div>
      )}

      {filesError && (
        <Toast message={filesError} variant="error" />
      )}

      {!loadingFiles &&
        !filesError &&
        files.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">▢</div>
            <strong>لا توجد ملفات حتى الآن</strong>
            <span>
              ارفع أول ملف باستخدام منطقة الرفع أعلاه.
            </span>
          </div>
        )}

      {files.length > 0 && (
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>الملف</th>
                <th>الحجم</th>
                <th>آخر تعديل</th>
                <th>الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {files.map((file) => (
                <tr key={file.key}>
                  <td>
                    <div className="file-cell">
                      <div className="file-icon">
                        DOC
                      </div>

                      <strong
                        className="bidi-safe"
                        dir="auto"
                      >
                        {getDisplayName(file.key)}
                      </strong>
                    </div>
                  </td>

                  <td>
                    {(file.size / 1024 / 1024).toFixed(2)}
                    {' '}MB
                  </td>

                  <td>
                    {new Date(
                      file.lastModified,
                    ).toLocaleString('ar-LY')}
                  </td>

                  <td>
                    <div className="action-group">
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() =>
                          onDownload(file)
                        }
                      >
                        تنزيل
                      </button>

                      <button
                        className="btn btn-small btn-secondary"
                        onClick={() =>
                          onInternalShare(file)
                        }
                        disabled={
                          sharingKey === file.key
                        }
                      >
                        {sharingKey === file.key
                          ? 'جارٍ المشاركة...'
                          : 'مشاركة داخليًا'}
                      </button>

                      <button
                        className="btn btn-small btn-secondary"
                        onClick={() =>
                          onExternalShare(file)
                        }
                        disabled={
                          externalSharingKey === file.key
                        }
                      >
                        {externalSharingKey === file.key
                          ? 'جارٍ الإنشاء...'
                          : 'مشاركة خارجية'}
                      </button>

                      <ConfirmModal
                        className="btn btn-small btn-danger"
                        message={`Delete "${getDisplayName(file.key)}"?\n\nThis file will no longer be available in the portal.`}
                        canConfirm={canDelete}
                        onConfirm={() => onDelete(file)}
                        disabled={deletingKey === file.key}
                      >
                        {deletingKey === file.key
                          ? 'جارٍ الحذف...'
                          : 'حذف'}
                      </ConfirmModal>
                    </div>
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
