import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth.js'

export default function LoginPage({ setAuth }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      setAuth({ token: data.access_token, role: data.role, roles: data.roles || [data.role], username: data.username })
      // Pure supplier users land on their portal; multi-role users (e.g. repair centre +
      // supplier) land on the dashboard and reach the portal from the sidebar.
      const roles = data.roles || [data.role]
      const dest = roles.length > 0 && roles.every(r => r === 'supplier') ? '/supplier-portal' : '/dashboard'
      navigate(dest, { replace: true })
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Brand bar */}
        <div style={{ background: '#5ba4cf', borderRadius: 'var(--radius-card) var(--radius-card) 0 0', padding: '1.5rem 2rem', textAlign: 'center' }}>
          <div style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-h2)', color: '#fff', letterSpacing: '-0.01em' }}>
            Terminal Stock App
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--fs-body-sm)', marginTop: 4 }}>
            Payment Terminal Management
          </div>
        </div>

        {/* Card */}
        <div className="e2o-card" style={{ borderRadius: '0 0 var(--radius-card) var(--radius-card)', padding: '2rem', borderTop: 'none', boxShadow: 'var(--shadow-card)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-2)', marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="e2o-input"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-2)', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="e2o-input"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div style={{ background: '#fdf2f2', color: 'var(--alert)', border: '1px solid #e9a8a4', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 'var(--fs-body-sm)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="e2o-btn e2o-btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: loading ? 0.65 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Ownership notice */}
          <p style={{ marginTop: 'var(--sp-6)', textAlign: 'center', fontSize: 'var(--fs-body-sm)', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            © {new Date().getFullYear()} Terminal Stock App is owned by Wise Chain Consulting
            {' '}(<a href="https://www.wise-chain-consult.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2)', textDecoration: 'underline' }}>www.wise-chain-consult.com</a>).
            <br />All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
