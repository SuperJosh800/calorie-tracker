import { useState } from 'react'
import type { Sync } from '../sync'

/** Sign in or create an account on your own server. */
export function AccountForm({ sync, onDone }: { sync: Sync; onDone?: () => void }) {
  const [server, setServer] = useState(sync.server)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'signin' | 'signup'>()
  const [error, setError] = useState<string>()
  const ready = server.trim() && email.trim() && password

  const submit = async (create: boolean) => {
    setBusy(create ? 'signup' : 'signin')
    setError(undefined)
    try {
      await sync.signIn(server, email.trim(), password, create)
      setPassword('')
      onDone?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <form
      className="account-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !busy) void submit(false)
      }}
    >
      <label className="field">
        <span>Server address</span>
        <input
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder="joshserver1.tail1234.ts.net"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="off" />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={8} />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="btn primary grow" disabled={!ready || !!busy}>
          {busy === 'signin' ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn grow" disabled={!ready || !!busy} onClick={() => void submit(true)}>
          {busy === 'signup' ? 'Creating…' : 'Create account'}
        </button>
      </div>
    </form>
  )
}

function statusText(sync: Sync) {
  const s = sync.status
  if (s.state === 'syncing') return 'Syncing…'
  if (s.state === 'error') return s.message
  if (s.state === 'ok') {
    const time = new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `Synced at ${time}`
  }
  return 'Waiting to sync'
}

export function AccountCard({ sync }: { sync: Sync }) {
  return (
    <section className="card">
      <h2 className="card-title">Account</h2>
      {sync.email ? (
        <>
          <p className="account-who">
            Signed in as <strong>{sync.email}</strong>
          </p>
          <p className={`hint account-status${sync.status.state === 'error' ? ' error' : ''}`} aria-live="polite">
            {statusText(sync)}
          </p>
          <p className="hint">Your diary, weigh-ins, foods and goals sync with {new URL(sync.server).host} whenever they change.</p>
          <div className="button-row">
            <button className="btn grow" onClick={() => void sync.sync()} disabled={sync.status.state === 'syncing'}>
              Sync now
            </button>
            <button className="btn grow" onClick={sync.signOut}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            Sign in to your own server to keep the same diary on your phone and the website, and to keep it safe if you lose
            your phone. Use the address from Tailscale on your server.
          </p>
          <AccountForm sync={sync} />
        </>
      )}
    </section>
  )
}
