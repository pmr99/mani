import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Accounts } from './pages/Accounts'
import { Analysis } from './pages/Analysis'
import { Wealth } from './pages/Wealth'

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#0f1117]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wealth" element={<Wealth />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:accountId" element={<Accounts />} />
            <Route path="/analysis" element={<Analysis />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
