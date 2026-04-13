import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Accounts } from './pages/Accounts'
import { Analysis } from './pages/Analysis'
import { Wealth } from './pages/Wealth'
import { OAuthReturn } from './pages/OAuthReturn'

function App() {
  return (
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
            <Sidebar />
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
            <MobileNav />
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
