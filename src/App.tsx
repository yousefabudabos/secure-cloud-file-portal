import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import './App.css'

type FileItem = {
  key: string
  size: number
  lastModified: string
}

type UploadResponse = {
  upload: {
    url: string
    fields: Record<string, string>
  }
  key: string
  expiresIn: number
  maxFileSize: number
}

type SharedItem = {
  shareId: string
  objectKey: string
  fileName: string
  ownerSub: string
  createdAt: string
}

type ExternalShareResponse = {
  shareId: string
  token: string
  expiresAt: number
  expiresInHours: number
  maxDownloads: number
}

type ExternalShareItem = {
  shareId: string
  fileName: string
  recipientEmail: string
  createdAt: string
  expiresAt: number
  downloadCount: number
  maxDownloads: number
  status: 'active' | 'revoked' | 'expired' | 'limit_reached'
}

function App() {
  const auth = useAuth()

  const [files, setFiles] = useState<FileItem[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [filesError, setFilesError] = useState('')

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  const [deletingKey, setDeletingKey] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')

  const [sharingKey, setSharingKey] = useState('')
  const [shareMessage, setShareMessage] = useState('')

  const [sharedFiles, setSharedFiles] = useState<SharedItem[]>([])
  const [loadingShared, setLoadingShared] = useState(false)
  const [sharedError, setSharedError] = useState('')

  const [externalSharingKey, setExternalSharingKey] = useState('')
  const [externalShareMessage, setExternalShareMessage] = useState('')
  const [externalShareUrl, setExternalShareUrl] = useState('')
  const [externalShareId, setExternalShareId] = useState('')
  const [revokingExternalId, setRevokingExternalId] = useState('')

  const [externalShares, setExternalShares] =
    useState<ExternalShareItem[]>([])
  const [loadingExternalShares, setLoadingExternalShares] =
    useState(false)
  const [externalSharesError, setExternalSharesError] =
    useState('')

  const [externalDownloading, setExternalDownloading] = useState(false)
  const [externalDownloadMessage, setExternalDownloadMessage] =
    useState('')

  const queryExternalToken =
    new URLSearchParams(window.location.search).get('external')

  const hashExternalToken =
    new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    ).get('external')

  const externalToken =
    hashExternalToken || queryExternalToken

  const getDisplayName = (key: string) => {
    const filePart = key.split('/').pop() ?? key

    if (filePart.length > 37) {
      return filePart.slice(37)
    }

    return filePart
  }

  const loadFiles = async () => {
    if (!auth.user?.access_token) {
      return
    }

    setLoadingFiles(true)
    setFilesError('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/files`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      setFiles(data.files ?? [])
    } catch (error) {
      console.error(error)
      setFilesError('Unable to load files.')
    } finally {
      setLoadingFiles(false)
    }
  }

  const loadSharedFiles = async () => {
    if (!auth.user?.access_token) {
      return
    }

    setLoadingShared(true)
    setSharedError('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/shares`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(
          `Shared files request failed: ${response.status}`,
        )
      }

      const data = await response.json()
      setSharedFiles(data.shares ?? [])
    } catch (error) {
      console.error(error)
      setSharedError('Unable to load shared files.')
    } finally {
      setLoadingShared(false)
    }
  }

  const loadExternalShares = async () => {
    if (!auth.user?.access_token) {
      return
    }

    setLoadingExternalShares(true)
    setExternalSharesError('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/external-shares`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(
          `External shares request failed: ${response.status}`,
        )
      }

      const data = await response.json()
      setExternalShares(data.shares ?? [])
    } catch (error) {
      console.error(error)
      setExternalSharesError(
        'Unable to load external shares.',
      )
    } finally {
      setLoadingExternalShares(false)
    }
  }

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      loadFiles()
      loadSharedFiles()
      loadExternalShares()
    }
  }, [auth.isAuthenticated, auth.user?.access_token])

  const handleUpload = async () => {
    if (!selectedFile || !auth.user?.access_token) {
      return
    }

    const maxSize = 100 * 1024 * 1024

    if (selectedFile.size > maxSize) {
      setUploadMessage('File exceeds the 100 MB limit.')
      return
    }

    setUploading(true)
    setUploadMessage('')

    try {
      const requestResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/uploads`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType:
              selectedFile.type || 'application/octet-stream',
          }),
        },
      )

      if (!requestResponse.ok) {
        throw new Error(
          `Upload request failed: ${requestResponse.status}`,
        )
      }

      const uploadData: UploadResponse =
        await requestResponse.json()

      const formData = new FormData()

      Object.entries(uploadData.upload.fields).forEach(
        ([key, value]) => {
          formData.append(key, value)
        },
      )

      formData.append('file', selectedFile)

      const s3Response = await fetch(uploadData.upload.url, {
        method: 'POST',
        body: formData,
      })

      if (!s3Response.ok) {
        throw new Error(
          `S3 upload failed: ${s3Response.status}`,
        )
      }

      setUploadMessage('File uploaded successfully.')
      setSelectedFile(null)

      await loadFiles()
    } catch (error) {
      console.error(error)
      setUploadMessage('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (file: FileItem) => {
    if (!auth.user?.access_token) {
      return
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/downloads`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: file.key,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          `Download request failed: ${response.status}`,
        )
      }

      const data = await response.json()

      const link = document.createElement('a')
      link.href = data.downloadUrl
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error(error)
      alert('Download failed.')
    }
  }

  const handleSharedDownload = async (shared: SharedItem) => {
    if (!auth.user?.access_token) {
      return
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/downloads`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: shared.objectKey,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          `Shared download failed: ${response.status}`,
        )
      }

      const data = await response.json()

      const link = document.createElement('a')
      link.href = data.downloadUrl
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error(error)
      alert('Download failed.')
    }
  }

  const handleExternalDownload = async () => {
    if (!externalToken) {
      return
    }

    setExternalDownloading(true)
    setExternalDownloadMessage('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/external-download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: externalToken,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            `External download failed: ${response.status}`,
        )
      }

      const link = document.createElement('a')
      link.href = data.downloadUrl
      document.body.appendChild(link)
      link.click()
      link.remove()

      setExternalDownloadMessage(
        `Download started. ${data.downloadCount} of ${data.maxDownloads} allowed downloads used.`,
      )
    } catch (error) {
      console.error(error)

      setExternalDownloadMessage(
        error instanceof Error
          ? error.message
          : 'Unable to download shared file.',
      )
    } finally {
      setExternalDownloading(false)
    }
  }

  const handleExternalShare = async (file: FileItem) => {
    if (!auth.user?.access_token) {
      return
    }

    const emailInput = window.prompt(
      'Recipient email (optional — the link must still be sent manually):',
    )

    if (emailInput === null) {
      return
    }

    const recipientEmail = emailInput.trim().toLowerCase()

    if (recipientEmail && !recipientEmail.includes('@')) {
      alert('Please enter a valid email address.')
      return
    }

    const expirationInput = window.prompt(
      'Link expiration in hours (1–168):',
      '24',
    )

    if (expirationInput === null) {
      return
    }

    const maxDownloadsInput = window.prompt(
      'Maximum downloads (1–20):',
      '5',
    )

    if (maxDownloadsInput === null) {
      return
    }

    const expiresInHours = Number(expirationInput)
    const maxDownloads = Number(maxDownloadsInput)

    if (
      !Number.isInteger(expiresInHours) ||
      expiresInHours < 1 ||
      expiresInHours > 168
    ) {
      alert('Expiration must be between 1 and 168 hours.')
      return
    }

    if (
      !Number.isInteger(maxDownloads) ||
      maxDownloads < 1 ||
      maxDownloads > 20
    ) {
      alert('Maximum downloads must be between 1 and 20.')
      return
    }

    setExternalSharingKey(file.key)
    setExternalShareMessage('')
    setExternalShareUrl('')
    setExternalShareId('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/external-shares`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: file.key,
            recipientEmail,
            expiresInHours,
            maxDownloads,
          }),
        },
      )

      const data: ExternalShareResponse & {
        message?: string
      } = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            `External share request failed: ${response.status}`,
        )
      }

      const appUrl = String(
        import.meta.env.VITE_APP_URL || window.location.origin,
      ).replace(/\/+$/, '')

      const shareUrl =
        `${appUrl}/#external=` +
        encodeURIComponent(data.token)

      setExternalShareUrl(shareUrl)
      setExternalShareId(data.shareId)

      await loadExternalShares()

      try {
        await navigator.clipboard.writeText(shareUrl)

        setExternalShareMessage(
          `External link created and copied. Expires in ${expiresInHours} hours; maximum ${maxDownloads} downloads.`,
        )
      } catch {
        setExternalShareMessage(
          `External link created. Expires in ${expiresInHours} hours; maximum ${maxDownloads} downloads.`,
        )
      }
    } catch (error) {
      console.error(error)

      setExternalShareMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create external share.',
      )
    } finally {
      setExternalSharingKey('')
    }
  }

  const handleRevokeExternalShare = async (
    shareId: string,
  ) => {
    if (!auth.user?.access_token || !shareId) {
      return
    }

    const confirmed = window.confirm(
      'Revoke this external sharing link?\n\nThe recipient will no longer be able to use it.',
    )

    if (!confirmed) {
      return
    }

    setRevokingExternalId(shareId)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/external-shares`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareId,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Revoke request failed: ${response.status}`,
        )
      }

      setExternalShareMessage(
        'External sharing link revoked successfully.',
      )

      if (shareId === externalShareId) {
        setExternalShareUrl('')
        setExternalShareId('')
      }

      await loadExternalShares()
    } catch (error) {
      console.error(error)

      setExternalShareMessage(
        error instanceof Error
          ? error.message
          : 'Unable to revoke external sharing link.',
      )
    } finally {
      setRevokingExternalId('')
    }
  }

  const handleShare = async (file: FileItem) => {
    if (!auth.user?.access_token) {
      return
    }

    const recipientEmail = window.prompt(
      `Share "${getDisplayName(file.key)}" with employee email:`,
    )?.trim().toLowerCase()

    if (!recipientEmail) {
      return
    }

    if (!recipientEmail.includes('@')) {
      alert('Please enter a valid email address.')
      return
    }

    setSharingKey(file.key)
    setShareMessage('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/shares`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: file.key,
            recipientEmail,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || `Share request failed: ${response.status}`,
        )
      }

      if (data.alreadyShared) {
        setShareMessage(
          `File is already shared with ${recipientEmail}.`,
        )
      } else {
        setShareMessage(
          `File shared successfully with ${recipientEmail}.`,
        )
      }
    } catch (error) {
      console.error(error)
      setShareMessage('Share failed.')
    } finally {
      setSharingKey('')
    }
  }

  const handleDelete = async (file: FileItem) => {
    if (!auth.user?.access_token) {
      return
    }

    const fileName = getDisplayName(file.key)

    const confirmed = window.confirm(
      `Delete "${fileName}"?\n\nThis file will no longer be available in the portal.`,
    )

    if (!confirmed) {
      return
    }

    setDeletingKey(file.key)
    setDeleteMessage('')

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/files`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: file.key,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          `Delete request failed: ${response.status}`,
        )
      }

      setDeleteMessage('File deleted successfully.')

      await loadFiles()
    } catch (error) {
      console.error(error)
      setDeleteMessage('Delete failed.')
    } finally {
      setDeletingKey('')
    }
  }

  const handleSignOut = async () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const logoutUri = import.meta.env.VITE_APP_URL
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN

    await auth.removeUser()

    window.location.href =
      `${cognitoDomain}/logout` +
      `?client_id=${clientId}` +
      `&logout_uri=${encodeURIComponent(logoutUri)}`
  }

  if (externalToken) {
    return (
      <div className="public-page" dir="rtl">
        <div className="public-card">
          <div className="public-brand">
            <div className="brand-mark">LISCO</div>
            <div>
              <strong>الشركة الليبية للحديد والصلب</strong>
              <span>بوابة مشاركة الملفات الآمنة</span>
            </div>
          </div>

          <div className="public-icon">↓</div>

          <h1>تنزيل ملف آمن</h1>

          <p className="public-description">
            تمت مشاركة ملف معك من خلال بوابة الشركة الليبية
            للحديد والصلب.
          </p>

          <p className="public-hint">
            قد يكون الرابط محدودًا بمدة صلاحية أو بعدد معين
            من مرات التنزيل.
          </p>

          <button
            className="btn btn-primary btn-large"
            onClick={handleExternalDownload}
            disabled={externalDownloading}
          >
            {externalDownloading
              ? 'جارٍ تجهيز الملف...'
              : 'تنزيل الملف'}
          </button>

          {externalDownloadMessage && (
            <div className="notice">
              {externalDownloadMessage}
            </div>
          )}

          <div className="security-note">
            اتصال آمن • الملفات محمية ومشفرة
          </div>
        </div>
      </div>
    )
  }

  if (auth.isLoading) {
    return (
      <div className="center-page">
        <div className="loader" />
        <p>جارٍ تحميل البوابة...</p>
      </div>
    )
  }

  if (auth.error) {
    return (
      <div className="center-page">
        <div className="auth-card">
          <h2>تعذر تسجيل الدخول</h2>
          <p>{auth.error.message}</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="login-page" dir="rtl">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark brand-mark-large">
              LISCO
            </div>

            <h1>بوابة مشاركة الملفات الآمنة</h1>

            <p>
              مشاركة الملفات بطريقة آمنة وسهلة لموظفي
              الشركة الليبية للحديد والصلب.
            </p>
          </div>

          <button
            className="btn btn-primary btn-large login-button"
            onClick={() => auth.signinRedirect()}
          >
            تسجيل الدخول بحساب الشركة
          </button>

          <div className="login-security">
            🔒 دخول آمن ومصادقة متعددة العوامل
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="portal" dir="rtl">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="company-brand">
            <div className="brand-mark">LISCO</div>

            <div className="company-text">
              <strong>الشركة الليبية للحديد والصلب</strong>
              <span>LIBYAN IRON AND STEEL COMPANY</span>
            </div>

            <div className="brand-divider" />

            <div className="portal-title">
              <strong>بوابة مشاركة الملفات الآمنة</strong>
              <span>Secure File Sharing Portal</span>
            </div>
          </div>

          <div className="user-area">
            <div className="user-avatar">
              {(auth.user?.profile.email || 'U')
                .toString()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="user-info">
              <strong>المستخدم</strong>
              <span>{auth.user?.profile.email}</span>
            </div>

            <button
              className="btn btn-header"
              onClick={handleSignOut}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <nav className="portal-nav">
        <div className="nav-inner">
          <a href="#my-files" className="nav-link active">
            ملفاتي
          </a>

          <a href="#shared-with-me" className="nav-link">
            تمت مشاركتها معي
          </a>

          <a href="#external-shares" className="nav-link">
            المشاركات الخارجية
          </a>
        </div>
      </nav>

      <main className="dashboard">
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
              setSelectedFile(
                event.dataTransfer.files?.[0] ?? null,
              )
            }}
          >
            <input
              className="file-input"
              type="file"
              onChange={(event) =>
                setSelectedFile(
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
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading
                  ? 'جارٍ الرفع...'
                  : 'رفع الملف'}
              </button>
            </div>
          )}

          {uploadMessage && (
            <div
              className={
                uploadMessage.includes('successfully')
                  ? 'notice success'
                  : 'notice error'
              }
            >
              {uploadMessage}
            </div>
          )}
        </section>

        {(shareMessage ||
          deleteMessage ||
          externalShareMessage) && (
          <div className="messages-area">
            {shareMessage && (
              <div className="notice success">
                {shareMessage}
              </div>
            )}

            {deleteMessage && (
              <div className="notice">
                {deleteMessage}
              </div>
            )}

            {externalShareMessage && (
              <div className="notice success">
                {externalShareMessage}
              </div>
            )}
          </div>
        )}

        {externalShareUrl && (
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
                onClick={() =>
                  navigator.clipboard.writeText(
                    externalShareUrl,
                  )
                }
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
              <button
                className="btn btn-danger-outline"
                onClick={() =>
                  handleRevokeExternalShare(externalShareId)
                }
                disabled={
                  revokingExternalId === externalShareId
                }
              >
                {revokingExternalId === externalShareId
                  ? 'جارٍ الإلغاء...'
                  : 'إلغاء مشاركة الرابط'}
              </button>
            )}
          </section>
        )}

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
            <div className="notice error">
              {filesError}
            </div>
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

                          <strong>
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
                              handleDownload(file)
                            }
                          >
                            تنزيل
                          </button>

                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() =>
                              handleShare(file)
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
                              handleExternalShare(file)
                            }
                            disabled={
                              externalSharingKey === file.key
                            }
                          >
                            {externalSharingKey === file.key
                              ? 'جارٍ الإنشاء...'
                              : 'مشاركة خارجية'}
                          </button>

                          <button
                            className="btn btn-small btn-danger"
                            onClick={() =>
                              handleDelete(file)
                            }
                            disabled={
                              deletingKey === file.key
                            }
                          >
                            {deletingKey === file.key
                              ? 'جارٍ الحذف...'
                              : 'حذف'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
            <div className="notice error">
              {sharedError}
            </div>
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
                          <strong>{shared.fileName}</strong>
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
                            handleSharedDownload(shared)
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

        <section
          id="external-shares"
          className="content-card"
        >
          <div className="section-header">
            <div>
              <span className="section-icon">⌁</span>

              <div>
                <h2>المشاركات الخارجية</h2>
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
            <div className="notice error">
              {externalSharesError}
            </div>
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
                          <strong>{share.fileName}</strong>
                        </div>
                      </td>

                      <td>
                        {share.recipientEmail ||
                          'غير محدد'}
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
                          <button
                            className="btn btn-small btn-danger-outline"
                            onClick={() =>
                              handleRevokeExternalShare(
                                share.shareId,
                              )
                            }
                            disabled={
                              revokingExternalId ===
                              share.shareId
                            }
                          >
                            {revokingExternalId ===
                            share.shareId
                              ? 'جارٍ الإلغاء...'
                              : 'إلغاء الرابط'}
                          </button>
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

        <footer className="portal-footer">
          <span>
            بوابة مشاركة الملفات الآمنة
          </span>

          <span>
            الشركة الليبية للحديد والصلب — تقنية المعلومات
          </span>
        </footer>
      </main>
    </div>
  )
}

export default App
