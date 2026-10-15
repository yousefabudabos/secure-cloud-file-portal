import { useAuth } from 'react-oidc-context'
import './App.css'

function App() {
  const auth = useAuth()

  const handleSignOut = () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const logoutUri = import.meta.env.VITE_APP_URL
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN

    auth.removeUser()

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

      <h2>Dashboard</h2>
      <p>Your secure files will appear here.</p>

      <button onClick={handleSignOut}>
        Sign out
      </button>
    </main>
  )
}

export default App
