import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
    // onAuthStateChange in useAuth will handle the redirect
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Mani</span>
        </div>

        {/* Login card */}
        <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm bg-[#252839] border border-[#2a2d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 text-sm bg-[#252839] border border-[#2a2d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="Password"
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-rose-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-4">Personal finance tracker</p>
      </div>
    </div>
  )
}
