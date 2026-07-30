import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSigningIn(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSigningIn(false)
    if (error) setError(error.message)
  }

  if (loading) return null

  if (!session) {
    return (
      <div className="min-h-screen bg-ground text-ink font-body flex justify-center">
        <div className="w-full max-w-[480px] min-h-screen flex flex-col items-center justify-center px-6">
          <div className="w-full">
            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.2em] uppercase text-muted font-display">Welcome back</p>
              <h1 className="text-4xl font-display font-700 text-ink mt-1 tracking-tight">LIFT</h1>
            </div>

            <form onSubmit={handleSignIn} className="bg-surface border border-border rounded-sm p-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-muted font-display">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-2 w-full bg-surface2 border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/40 transition-colors"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-muted font-display">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-2 w-full bg-surface2 border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/40 transition-colors"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={signingIn}
                className="w-full py-4 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.2em] rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {signingIn ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
