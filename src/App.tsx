import { useCallback, useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import Header from './components/Header'
import UploadCard from './components/UploadCard'
import MyFiles from './components/MyFiles'
import SharedWithMe from './components/SharedWithMe'
import ExternalShares, { ExternalShareLink } from './components/ExternalShares'
import InternalShareModal from './components/InternalShareModal'
import ExternalShareModal from './components/ExternalShareModal'
import Toast from './components/Toast'
import ExternalDownloadPage from './pages/ExternalDownloadPage'
import * as api from './services/api'
import type { FileItem, SharedItem, ExternalShareItem } from './types'
import { startDownload } from './utils/files'
import './App.css'

function App() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

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

  const [internalShareFile, setInternalShareFile] =
    useState<FileItem | null>(null)
  const [internalRecipientEmail, setInternalRecipientEmail] =
    useState('')
  const [internalShareError, setInternalShareError] =
    useState('')

  const [sharedFiles, setSharedFiles] = useState<SharedItem[]>([])
  const [loadingShared, setLoadingShared] = useState(false)
  const [sharedError, setSharedError] = useState('')

  const [externalSharingKey, setExternalSharingKey] = useState('')
  const [externalShareMessage, setExternalShareMessage] = useState('')

  const [externalShareFile, setExternalShareFile] =
    useState<FileItem | null>(null)
  const [externalRecipientEmail, setExternalRecipientEmail] =
    useState('')
  const [externalExpiresInHours, setExternalExpiresInHours] =
    useState('24')
  const [externalMaxDownloads, setExternalMaxDownloads] =
    useState('5')
  const [externalShareError, setExternalShareError] =
    useState('')
  const [externalShareUrl, setExternalShareUrl] = useState('')
  const [externalShareId, setExternalShareId] = useState('')
  const [revokingExternalId, setRevokingExternalId] = useState('')

  const [externalShares, setExternalShares] =
    useState<ExternalShareItem[]>([])
  const [loadingExternalShares, setLoadingExternalShares] =
    useState(false)
  const [externalSharesError, setExternalSharesError] =
    useState('')

  const queryExternalToken =
    new URLSearchParams(window.location.search).get('external')

  const hashExternalToken =
    new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    ).get('external')

  const externalToken =
    hashExternalToken || queryExternalToken

  const isValidEmail = (value: string) => {
    const email = value.trim()

    if (!email || email.length > 254 || email.includes(' ')) {
      return false
    }

    const atIndex = email.lastIndexOf('@')

    if (
      atIndex <= 0 ||
      atIndex === email.length - 1
    ) {
      return false
    }

    const domain = email.slice(atIndex + 1)

    return (
      domain.includes('.') &&
      !domain.startsWith('.') &&
      !domain.endsWith('.')
    )
  }

  const loadFiles = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setLoadingFiles(true)
    setFilesError('')

    try {
      const data = await api.getFiles(accessToken)
      setFiles(data.files ?? [])
    } catch (error) {
      console.error(error)
      setFilesError('Unable to load files.')
    } finally {
      setLoadingFiles(false)
    }
  }, [accessToken])

  const loadSharedFiles = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setLoadingShared(true)
    setSharedError('')

    try {
      const data = await api.getSharedFiles(accessToken)
      setSharedFiles(data.shares ?? [])
    } catch (error) {
      console.error(error)
      setSharedError('Unable to load shared files.')
    } finally {
      setLoadingShared(false)
    }
  }, [accessToken])

  const loadExternalShares = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setLoadingExternalShares(true)
    setExternalSharesError('')

    try {
      const data = await api.getExternalShares(accessToken)
      setExternalShares(data.shares ?? [])
    } catch (error) {
      console.error(error)
      setExternalSharesError(
        'Unable to load external shares.',
      )
    } finally {
      setLoadingExternalShares(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!auth.isAuthenticated || !accessToken) {
      return
    }

    // Queue the refresh so cleanup can cancel it if authentication changes.
    const refreshTimeout = window.setTimeout(() => {
      loadFiles()
      loadSharedFiles()
      loadExternalShares()
    }, 0)

    return () => window.clearTimeout(refreshTimeout)
  }, [
    auth.isAuthenticated,
    accessToken,
    loadFiles,
    loadSharedFiles,
    loadExternalShares,
  ])

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
      const uploadData = await api.requestUpload(auth.user.access_token, selectedFile)
      await api.uploadToStorage(uploadData.upload, selectedFile)

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
      const data = await api.getDownload(auth.user.access_token, file.key)
      startDownload(data.downloadUrl)
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
      const data = await api.getSharedDownload(auth.user.access_token, shared.objectKey)
      startDownload(data.downloadUrl)
    } catch (error) {
      console.error(error)
      alert('Download failed.')
    }
  }

  const openExternalShareModal = (file: FileItem) => {
    setExternalShareFile(file)
    setExternalRecipientEmail('')
    setExternalExpiresInHours('24')
    setExternalMaxDownloads('5')
    setExternalShareError('')
  }

  const closeExternalShareModal = () => {
    if (externalSharingKey) {
      return
    }

    setExternalShareFile(null)
    setExternalShareError('')
  }

  const handleExternalShare = async () => {
    const file = externalShareFile

    if (!file || !auth.user?.access_token) {
      return
    }

    const recipientEmail =
      externalRecipientEmail.trim().toLowerCase()

    if (
      recipientEmail &&
      !isValidEmail(recipientEmail)
    ) {
      setExternalShareError(
        'يرجى إدخال بريد إلكتروني صحيح.',
      )
      return
    }

    const expiresInHours = Number(externalExpiresInHours)
    const maxDownloads = Number(externalMaxDownloads)

    setExternalSharingKey(file.key)
    setExternalShareError('')
    setExternalShareMessage('')
    setExternalShareUrl('')
    setExternalShareId('')

    try {
      const data = await api.createExternalShare(auth.user.access_token, {
        key: file.key,
        recipientEmail,
        expiresInHours,
        maxDownloads,
      })

      const appUrl = String(
        import.meta.env.VITE_APP_URL ||
          window.location.origin,
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
          'تم إنشاء رابط المشاركة الخارجية ونسخه بنجاح.',
        )
      } catch {
        setExternalShareMessage(
          'تم إنشاء رابط المشاركة الخارجية بنجاح.',
        )
      }

      setExternalShareFile(null)
      setExternalRecipientEmail('')
    } catch (error) {
      console.error(error)

      setExternalShareError(
        error instanceof Error
          ? error.message
          : 'تعذر إنشاء رابط المشاركة الخارجية.',
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

    setRevokingExternalId(shareId)

    try {
      await api.revokeExternalShare(auth.user.access_token, shareId)

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

  const openInternalShareModal = (file: FileItem) => {
    setInternalShareFile(file)
    setInternalRecipientEmail('')
    setInternalShareError('')
  }

  const closeInternalShareModal = () => {
    if (sharingKey) {
      return
    }

    setInternalShareFile(null)
    setInternalShareError('')
  }

  const handleShare = async () => {
    const file = internalShareFile

    if (!file || !auth.user?.access_token) {
      return
    }

    const recipientEmail =
      internalRecipientEmail.trim().toLowerCase()

    if (!recipientEmail) {
      setInternalShareError(
        'أدخل البريد الإلكتروني للموظف المستلم.',
      )
      return
    }

    if (!isValidEmail(recipientEmail)) {
      setInternalShareError(
        'يرجى إدخال بريد إلكتروني صحيح.',
      )
      return
    }

    setSharingKey(file.key)
    setShareMessage('')
    setInternalShareError('')

    try {
      const data = await api.shareFile(
        auth.user.access_token,
        file.key,
        recipientEmail,
      )

      if (data.alreadyShared) {
        setShareMessage(
          `الملف مشارك مسبقًا مع ${recipientEmail}.`,
        )
      } else {
        setShareMessage(
          `تمت مشاركة الملف بنجاح مع ${recipientEmail}.`,
        )
      }

      setInternalShareFile(null)
      setInternalRecipientEmail('')
    } catch (error) {
      console.error(error)

      setInternalShareError(
        error instanceof Error
          ? error.message
          : 'تعذرت مشاركة الملف.',
      )
    } finally {
      setSharingKey('')
    }
  }

  const handleDelete = async (file: FileItem) => {
    if (!auth.user?.access_token) {
      return
    }

    setDeletingKey(file.key)
    setDeleteMessage('')

    try {
      await api.deleteFile(auth.user.access_token, file.key)

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
    return <ExternalDownloadPage token={externalToken} />
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
      <Header email={auth.user?.profile.email} onSignOut={handleSignOut} />

      <main className="dashboard">
        <UploadCard
          selectedFile={selectedFile}
          uploading={uploading}
          uploadMessage={uploadMessage}
          onSelectFile={setSelectedFile}
          onUpload={handleUpload}
        />

        {(shareMessage ||
          deleteMessage ||
          externalShareMessage) && (
          <div className="messages-area">
            {shareMessage && (
              <Toast message={shareMessage} variant="success" />
            )}

            {deleteMessage && (
              <Toast message={deleteMessage} />
            )}

            {externalShareMessage && (
              <Toast message={externalShareMessage} variant="success" />
            )}
          </div>
        )}

        {externalShareUrl && (
          <ExternalShareLink
            externalShareUrl={externalShareUrl}
            externalShareId={externalShareId}
            revokingExternalId={revokingExternalId}
            canRevoke={Boolean(accessToken)}
            onRevoke={handleRevokeExternalShare}
          />
        )}

        <MyFiles
          files={files}
          loadingFiles={loadingFiles}
          filesError={filesError}
          sharingKey={sharingKey}
          externalSharingKey={externalSharingKey}
          deletingKey={deletingKey}
          canDelete={Boolean(accessToken)}
          onDownload={handleDownload}
          onInternalShare={openInternalShareModal}
          onExternalShare={openExternalShareModal}
          onDelete={handleDelete}
        />

        <SharedWithMe
          sharedFiles={sharedFiles}
          loadingShared={loadingShared}
          sharedError={sharedError}
          onDownload={handleSharedDownload}
        />

        <ExternalShares
          externalShares={externalShares}
          loadingExternalShares={loadingExternalShares}
          externalSharesError={externalSharesError}
          revokingExternalId={revokingExternalId}
          canRevoke={Boolean(accessToken)}
          onRevoke={handleRevokeExternalShare}
        />

        {internalShareFile && (
          <InternalShareModal
            file={internalShareFile}
            recipientEmail={internalRecipientEmail}
            error={internalShareError}
            isSharing={Boolean(sharingKey)}
            onClose={closeInternalShareModal}
            onSubmit={handleShare}
            onRecipientEmailChange={(value) => {
              setInternalRecipientEmail(value)
              setInternalShareError('')
            }}
          />
        )}

        {externalShareFile && (
          <ExternalShareModal
            file={externalShareFile}
            recipientEmail={externalRecipientEmail}
            expiresInHours={externalExpiresInHours}
            maxDownloads={externalMaxDownloads}
            error={externalShareError}
            isSharing={Boolean(externalSharingKey)}
            onClose={closeExternalShareModal}
            onSubmit={handleExternalShare}
            onRecipientEmailChange={(value) => {
              setExternalRecipientEmail(value)
              setExternalShareError('')
            }}
            onExpiresInHoursChange={setExternalExpiresInHours}
            onMaxDownloadsChange={setExternalMaxDownloads}
          />
        )}

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
