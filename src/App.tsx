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
      <main>
        <h1>Secure File Portal</h1>

        <h2>External file download</h2>

        <p>
          A LISCO employee has shared a temporary secure
          file link with you.
        </p>

        <p>
          Access may be limited by expiration time and
          maximum download count.
        </p>

        <button
          onClick={handleExternalDownload}
          disabled={externalDownloading}
        >
          {externalDownloading
            ? 'Preparing download...'
            : 'Download file'}
        </button>

        {externalDownloadMessage && (
          <p>{externalDownloadMessage}</p>
        )}
      </main>
    )
  }

  if (auth.isLoading) {
    return (
      <main>
        <h2>Loading...</h2>
      </main>
    )
  }

  if (auth.error) {
    return (
      <main>
        <h2>Authentication error</h2>
        <p>{auth.error.message}</p>
      </main>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <main>
        <h1>Secure File Portal</h1>
        <p>Secure file sharing for authorized users.</p>

        <button onClick={() => auth.signinRedirect()}>
          Sign in with LISCO
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>Secure File Portal</h1>

      <p>
        Signed in as:
        <strong> {auth.user?.profile.email}</strong>
      </p>

      <h2>Upload file</h2>

      <input
        type="file"
        onChange={(event) =>
          setSelectedFile(event.target.files?.[0] ?? null)
        }
      />

      <br />
      <br />

      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>

      {selectedFile && (
        <p>
          Selected: {selectedFile.name} —{' '}
          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}

      {uploadMessage && <p>{uploadMessage}</p>}

      <hr />

      <h2>Files</h2>

      {shareMessage && <p>{shareMessage}</p>}

      {externalShareMessage && (
        <p>{externalShareMessage}</p>
      )}

      {externalShareUrl && (
        <>
          <p>
            External link:{' '}
            <a
              href={externalShareUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open secure link
            </a>
          </p>

          {externalShareId && (
            <p>
              <button
                onClick={() =>
                  handleRevokeExternalShare(externalShareId)
                }
                disabled={
                  revokingExternalId === externalShareId
                }
              >
                {revokingExternalId === externalShareId
                  ? 'Revoking...'
                  : 'Revoke external link'}
              </button>
            </p>
          )}
        </>
      )}

      {deleteMessage && <p>{deleteMessage}</p>}

      {loadingFiles && <p>Loading files...</p>}

      {filesError && <p>{filesError}</p>}

      {!loadingFiles &&
        !filesError &&
        files.length === 0 && (
          <p>No files available.</p>
        )}

      {files.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Last modified</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {files.map((file) => (
              <tr key={file.key}>
                <td>{getDisplayName(file.key)}</td>

                <td>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </td>

                <td>
                  {new Date(
                    file.lastModified,
                  ).toLocaleString()}
                </td>

                <td>
                  <button onClick={() => handleDownload(file)}>
                    Download
                  </button>

                  {' '}

                  <button
                    onClick={() => handleShare(file)}
                    disabled={sharingKey === file.key}
                  >
                    {sharingKey === file.key
                      ? 'Sharing...'
                      : 'Share'}
                  </button>

                  {' '}

                  <button
                    onClick={() => handleExternalShare(file)}
                    disabled={externalSharingKey === file.key}
                  >
                    {externalSharingKey === file.key
                      ? 'Creating link...'
                      : 'Share externally'}
                  </button>

                  {' '}

                  <button
                    onClick={() => handleDelete(file)}
                    disabled={deletingKey === file.key}
                  >
                    {deletingKey === file.key
                      ? 'Deleting...'
                      : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <br />

      <hr />

      <h2>Shared with me</h2>

      {loadingShared && <p>Loading shared files...</p>}

      {sharedError && <p>{sharedError}</p>}

      {!loadingShared &&
        !sharedError &&
        sharedFiles.length === 0 && (
          <p>No files shared with you.</p>
        )}

      {sharedFiles.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Shared at</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {sharedFiles.map((shared) => (
              <tr key={shared.shareId}>
                <td>{shared.fileName}</td>

                <td>
                  {new Date(shared.createdAt).toLocaleString()}
                </td>

                <td>
                  <button
                    onClick={() => handleSharedDownload(shared)}
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <br />

      <hr />

      <h2>My external shares</h2>

      {loadingExternalShares && (
        <p>Loading external shares...</p>
      )}

      {externalSharesError && (
        <p>{externalSharesError}</p>
      )}

      {!loadingExternalShares &&
        !externalSharesError &&
        externalShares.length === 0 && (
          <p>No external sharing links created.</p>
        )}

      {externalShares.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Downloads</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {externalShares.map((share) => (
              <tr key={share.shareId}>
                <td>{share.fileName}</td>

                <td>
                  {share.recipientEmail || 'Not specified'}
                </td>

                <td>
                  {share.status
                    .replace('_', ' ')
                    .toUpperCase()}
                </td>

                <td>
                  {share.downloadCount} / {share.maxDownloads}
                </td>

                <td>
                  {new Date(
                    share.expiresAt * 1000,
                  ).toLocaleString()}
                </td>

                <td>
                  {share.status === 'active' ? (
                    <button
                      onClick={() =>
                        handleRevokeExternalShare(
                          share.shareId,
                        )
                      }
                      disabled={
                        revokingExternalId === share.shareId
                      }
                    >
                      {revokingExternalId === share.shareId
                        ? 'Revoking...'
                        : 'Revoke'}
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <br />

      <button onClick={handleSignOut}>
        Sign out
      </button>
    </main>
  )
}

export default App
