import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import './App.css'

type FileItem = {
  key: string
  size: number
  lastModified: string
}

function App() {
  const auth = useAuth()

  const [files, setFiles] = useState<FileItem[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [filesError, setFilesError] = useState('')

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.access_token) {
      return
    }

    const loadFiles = async () => {
      setLoadingFiles(true)
      setFilesError('')

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/files`,
          {
            headers: {
              Authorization: `Bearer ${auth.user?.access_token}`,
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

    loadFiles()
  }, [auth.isAuthenticated, auth.user?.access_token])

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
    return <main><h2>Loading...</h2></main>
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

      <h2>Files</h2>

      {loadingFiles && <p>Loading files...</p>}

      {filesError && <p>{filesError}</p>}

      {!loadingFiles && !filesError && files.length === 0 && (
        <p>No files available.</p>
      )}

      {files.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Last modified</th>
            </tr>
          </thead>

          <tbody>
            {files.map((file) => (
              <tr key={file.key}>
                <td>{file.key}</td>
                <td>{file.size} bytes</td>
                <td>{new Date(file.lastModified).toLocaleString()}</td>
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
