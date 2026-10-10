import { useState } from 'react'
import { buildLinkFromDevice } from '../../data/repositories/profile'
import { encodeProfileLink, parseProfileLink, type ProfileLinkV1 } from '../../domain/profileLink'

interface Props {
  navigate: (hash: string) => void
}

/** Some messaging apps cut very long links; warn above this length. */
const LONG_LINK_CHARS = 8000

function joinUrl(link: ProfileLinkV1): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base}#/join?p=${encodeProfileLink(link)}`
}

export function ShareProfile({ navigate }: Props) {
  const [source, setSource] = useState<'device' | 'file'>('device')
  const [name, setName] = useState('')
  const [json, setJson] = useState('')
  const [url, setUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const show = (link: ProfileLinkV1) => {
    setUrl(joinUrl(link))
    setSummary(`${link.goals.length} goals, ${link.exercises.length} custom exercises, ${link.windows.length} windows`)
    setError('')
    setCopied(false)
  }

  const fromDevice = async () => {
    show(await buildLinkFromDevice(name.trim() ? { name: name.trim() } : undefined))
  }

  const fromJson = (text: string) => {
    try {
      const parsed = parseProfileLink(JSON.parse(text) as unknown)
      if (!parsed.ok) throw new Error(parsed.error)
      show(parsed.link)
    } catch (e) {
      setUrl('')
      setError(e instanceof Error ? e.message : 'Not a valid profile file')
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  const share = async () => {
    if (navigator.share) await navigator.share({ title: 'My training app', url }).catch(() => undefined)
    else await copy()
  }

  return (
    <div className="stack">
      <header className="topbar">
        <button className="ghost" aria-label="Back" onClick={() => navigate('#/settings')}>
          ←
        </button>
        <h1 className="grow">Share a profile</h1>
      </header>

      <p className="small muted">
        A link sets up someone's app with goals, exercises and equipment. Their training data stays on their own device.
        Anyone with the link can read what's in it, so send it privately.
      </p>

      <div className="chips" role="tablist" aria-label="Link source">
        <button role="tab" aria-selected={source === 'device'} aria-pressed={source === 'device'} onClick={() => setSource('device')}>
          From this device
        </button>
        <button role="tab" aria-selected={source === 'file'} aria-pressed={source === 'file'} onClick={() => setSource('file')}>
          From a profile file
        </button>
      </div>

      {source === 'device' ? (
        <section className="card">
          <p className="small">Copies your goals (as starting points), your own exercises and windows, and your equipment.</p>
          <label>
            Name to greet them with (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="primary" onClick={() => void fromDevice()}>
            Create link
          </button>
        </section>
      ) : (
        <section className="card">
          <p className="small">Paste or open a prepared profile file (JSON), e.g. one made for a specific person.</p>
          <textarea rows={6} value={json} onChange={(e) => setJson(e.target.value)} aria-label="Profile JSON" />
          <div className="row wrap">
            <button className="primary" disabled={!json.trim()} onClick={() => fromJson(json)}>
              Create link
            </button>
            <label className="button-like">
              Open file…
              <input
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void file.text().then((t) => (setJson(t), fromJson(t)))
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </section>
      )}

      {error && (
        <p className="notice pain small" role="alert">
          {error}
        </p>
      )}

      {url && (
        <section className="card" aria-label="Your link">
          <strong>Link ready</strong>
          <p className="small muted">{summary}</p>
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Profile link" data-testid="profile-link" />
          {url.length > LONG_LINK_CHARS && (
            <p className="notice small">This link is long ({url.length} characters). If the message app cuts it, send it as a note or email.</p>
          )}
          <div className="row wrap">
            <button className="primary" onClick={() => void share()}>
              Share…
            </button>
            <button onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        </section>
      )}
    </div>
  )
}
