import React from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import Layout from './components/layout/Layout.jsx'
import LoginScreen from './components/auth/LoginScreen.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#b00', background: '#fff0f0', minHeight: '100vh' }}>
        <h2>App Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{String(this.state.error)}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12, color: '#666' }}>{this.state.error?.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

function AuthGate() {
  const { currentUser, activePageId } = useAuth()
  // Not logged in, or logged in but hasn't picked a page yet
  if (!currentUser || !activePageId) return <LoginScreen />
  return (
    <AppProvider key={activePageId} pageId={activePageId}>
      <Layout />
    </AppProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ErrorBoundary>
  )
}
