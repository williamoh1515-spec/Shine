import type { EvidenceLevel } from '../../config/balance.config'
import type { BalanceResult } from '../../domain/balance'
import type { Exercise } from '../../domain/models'
import { exerciseName } from '../format'

interface Props {
  results: BalanceResult[]
  exercises: Record<string, Exercise>
  windowId: string
}

const evidenceText: Record<EvidenceLevel, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  weak: 'Weak evidence',
  practice: 'Coaching practice (no direct study)',
}

const round1 = (n: number) => Math.round(n * 10) / 10

function status(r: BalanceResult): { icon: string; text: string; problem: boolean } {
  const verdict = r.measured?.verdict ?? r.volume?.verdict
  if (verdict === 'ok') return { icon: '✓', text: 'Balanced', problem: false }
  if (verdict === 'lowA') return { icon: '⚠', text: `Low: ${r.pair.a.label.toLowerCase()}`, problem: true }
  if (verdict === 'lowB') return { icon: '⚠', text: `Low: ${r.pair.b.label.toLowerCase()}`, problem: true }
  if (!r.pair.volume && !r.pair.strength) return { icon: 'ⓘ', text: 'Check yourself', problem: false }
  return { icon: '…', text: 'Not enough data yet', problem: false }
}

function Bars({ a, b, aLabel, bLabel, unit }: { a: number; b: number; aLabel: string; bLabel: string; unit: string }) {
  const max = Math.max(a, b, 1e-9)
  const row = (label: string, value: number) => (
    <div className="balance-row">
      <span className="small">{label}</span>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${(value / max) * 100}%`, background: 'var(--series-1)' }} />
      </div>
      <span className="small tabular">
        {round1(value)} {unit}
      </span>
    </div>
  )
  return (
    <div className="stack" style={{ gap: 4 }}>
      {row(aLabel, a)}
      {row(bLabel, b)}
    </div>
  )
}

/** Opposite-muscle balance: measured ratios when tested, otherwise weekly sets; ⓘ explains each ratio. */
export function BalanceCard({ results, exercises, windowId }: Props) {
  // Problems first, then balanced, then the rest.
  const order = (r: BalanceResult) => (status(r).problem ? 0 : (r.measured?.verdict ?? r.volume?.verdict) === 'ok' ? 1 : 2)
  const sorted = [...results].sort((x, y) => order(x) - order(y))

  return (
    <section className="card" aria-labelledby="balance-title">
      <div>
        <h3 id="balance-title">Muscle balance</h3>
        <p className="small muted">
          Each muscle against its opposite, from your last 4 weeks. Log the ratio-test exercises to see real strength ratios.
        </p>
      </div>
      <ul className="balance-list">
        {sorted.map((r) => {
          const s = status(r)
          const { pair } = r
          return (
            <li key={pair.id} className={s.problem ? 'problem' : ''}>
              <div className="row spread">
                <strong>{pair.title}</strong>
                <span className={`badge ${s.problem ? 'warn' : ''}`}>
                  <span aria-hidden="true">{s.icon}</span> {s.text}
                </span>
              </div>
              {r.measured && pair.strength && (
                <p className="small">
                  Measured ratio <strong className="tabular">{r.measured.ratio.toFixed(2)}</strong> (aim{' '}
                  {pair.strength.max ? `${pair.strength.min}–${pair.strength.max}` : `≥ ${pair.strength.min}`}, rough guide from
                  machine tests)
                </p>
              )}
              {!r.measured && r.volume && r.volume.verdict !== undefined && (
                <Bars a={r.volume.aPerWeek} b={r.volume.bPerWeek} aLabel={pair.a.label} bLabel={pair.b.label} unit="sets/wk" />
              )}
              {r.fixes.length > 0 && (
                <p className="small">
                  Add:{' '}
                  {r.fixes.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ' · '}
                      <a href={`#/w/${windowId}/${id}`}>{exerciseName(id, exercises)}</a>
                    </span>
                  ))}
                </p>
              )}
              <details>
                <summary className="small">ⓘ Best ratio and why</summary>
                <div className="stack small" style={{ gap: 6, paddingTop: 4 }}>
                  <p>
                    <strong>Aim:</strong> {pair.info.aim}
                  </p>
                  <p>
                    <strong>Why:</strong> {pair.info.why}
                  </p>
                  <p className="muted">
                    {evidenceText[pair.info.evidence]}. {pair.info.evidenceNote}{' '}
                    {pair.info.source && (
                      <a href={pair.info.source} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    )}
                  </p>
                  {pair.strength && (
                    <p className="muted">
                      Test it: {exerciseName(pair.strength.testA, exercises)} vs {exerciseName(pair.strength.testB, exercises)}, same rep
                      range, within a week of each other.
                    </p>
                  )}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
