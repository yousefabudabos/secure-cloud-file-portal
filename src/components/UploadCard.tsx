import Toast from './Toast'

type UploadCardProps = {
  selectedFile: File | null
  uploading: boolean
  uploadMessage: string
  onSelectFile: (file: File | null) => void
  onUpload: () => Promise<void>
}

export default function UploadCard({
  selectedFile,
  uploading,
  uploadMessage,
  onSelectFile,
  onUpload,
}: UploadCardProps) {
  return (
    <section className="upload-card">
      <div className="upload-copy">
        <span className="eyebrow">رفع الملفات</span>

        <h1>شارك ملفاتك بأمان</h1>

        <p>
          ارفع المستندات والصور والملفات ثم شاركها مع
          موظفي الشركة أو مع جهة خارجية.
        </p>

        <div className="security-points">
          <span>✓ تشفير آمن</span>
          <span>✓ وصول حسب الصلاحيات</span>
          <span>✓ حد أقصى 100 MB</span>
        </div>
      </div>

      <label
        className="upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          onSelectFile(
            event.dataTransfer.files?.[0] ?? null,
          )
        }}
      >
        <input
          className="file-input"
          type="file"
          onChange={(event) =>
            onSelectFile(
              event.target.files?.[0] ?? null,
            )
          }
        />

        <div className="upload-symbol">↑</div>

        <strong>
          اسحب الملف هنا أو اضغط للاختيار
        </strong>

        <span>
          المستندات والصور والملفات حتى 100 MB
        </span>

        <div className="btn btn-primary">
          اختيار ملف
        </div>
      </label>

      {selectedFile && (
        <div className="selected-file">
          <div>
            <strong>{selectedFile.name}</strong>
            <span>
              {(selectedFile.size / 1024 / 1024).toFixed(2)}
              {' '}MB
            </span>
          </div>

          <button
            className="btn btn-primary"
            onClick={onUpload}
            disabled={uploading}
          >
            {uploading
              ? 'جارٍ الرفع...'
              : 'رفع الملف'}
          </button>
        </div>
      )}

      {uploadMessage && (
        <Toast
          message={uploadMessage}
          variant={uploadMessage.includes('successfully') ? 'success' : 'error'}
        />
      )}
    </section>
  )
}
