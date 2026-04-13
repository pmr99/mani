import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Accounts } from './pages/Accounts'
import { Analysis } from './pages/Analysis'
import { Wealth } from './pages/Wealth'
import { OAuthReturn } from './pages/OAuthReturn'
import { Login } from './pages/Login'
import { useAuth } from './hooks/useAuth'
import { usePrivacyProvider } from './hooks/usePrivacy'

function App() {
  const { session, loading, signOut } = useAuth()
  const privacy = usePrivacyProvider()

  // Loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in → show login
  if (!session) {
    return <Login />
  }

  // Authenticated → show app
  return (
    <privacy.Provider value={{ revealed: privacy.revealed, toggle: privacy.toggle, mask: privacy.mask }}>
      <BrowserRouter>
        <Routes>
          {/* OAuth return — no sidebar, Plaid Link auto-opens to complete handshake */}
          <Route path="/oauth-return" element={
            <div className="flex min-h-screen bg-[#0f1117]">
              <main className="flex-1 overflow-auto">
                <OAuthReturn />
              </main>
            </div>
          } />

          {/* Main app layout */}
          <Route path="*" element={
            <div className="flex min-h-screen bg-[#0f1117]">
              <Sidebar signOut={signOut} />
              <main className="flex-1 overflow-auto pb-16 md:pb-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/wealth" element={<Wealth />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/accounts/:accountId" element={<Accounts />} />
                  <Route path="/analysis" element={<Analysis />} />
                </Routes>
              </main>
              <MobileNav signOut={signOut} />
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </privacy.Provider>
  )
}

export default App
