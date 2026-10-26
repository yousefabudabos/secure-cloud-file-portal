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

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      loadFiles()
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

      <button onClick={handleSignOut}>
        Sign out
      </button>
    </main>
  )
}

export default App
