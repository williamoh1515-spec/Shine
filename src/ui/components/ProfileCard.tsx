import { useState } from 'react'
import { saveProfile } from '../../data/repositories/catalog'
import type { Profile } from '../../domain/models'

const toNumber = (s: string): number | undefined => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
}

/** "16, 4 , 12" → [4, 12, 16] */
function parseBellList(text: string): number[] {
  const values = text
    .split(/[,;\s]+/)
    .map(toNumber)
    .filter((n): n is number => n !== undefined && n <= 100)
  return [...new Set(values)].sort((a, b) => a - b)
}

export function ProfileCard({ profile }: { profile: Profile }) {
  const eq = profile.equipment
  const [name, setName] = useState(profile.name ?? '')
  const [mass, setMass] = useState(profile.bodyMassKg?.toString() ?? '')
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? '')
  const [bells, setBells] = useState(eq?.kettlebellsKg.join(', ') ?? '')
  const [bar, setBar] = useState(eq?.pullUpBar ?? false)
  const [bands, setBands] = useState(eq?.bands ?? false)
  const [plates, setPlates] = useState(eq?.plateIncrementKg?.toString() ?? '')
  const [saved, setSaved] = useState(false)

  const save = async () => {
    const next: Profile = {}
    if (name.trim()) next.name = name.trim()
    const m = toNumber(mass)
    if (m !== undefined) next.bodyMassKg = m
    const h = toNumber(height)
    if (h !== undefined) next.heightCm = h
    const kettlebellsKg = parseBellList(bells)
    const plateIncrementKg = toNumber(plates)
    if (kettlebellsKg.length > 0 || bar || bands || plateIncrementKg !== undefined) {
      next.equipment = { kettlebellsKg, pullUpBar: bar, bands, ...(plateIncrementKg !== undefined ? { plateIncrementKg } : {}) }
    }
    await saveProfile(next)
    setSaved(true)
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setSaved(false)
  }

  return (
    <section className="card" aria-labelledby="profile-title">
      <h3 id="profile-title">Profile & equipment</h3>
      <div className="row wrap">
        <label className="grow">
          Name
          <input value={name} onChange={(e) => touch(setName)(e.target.value)} />
        </label>
        <label style={{ width: 96 }}>
          Weight (kg)
          <input inputMode="decimal" value={mass} onChange={(e) => touch(setMass)(e.target.value)} />
        </label>
        <label style={{ width: 96 }}>
          Height (cm)
          <input inputMode="numeric" value={height} onChange={(e) => touch(setHeight)(e.target.value)} />
        </label>
      </div>
      <p className="small muted">Body weight makes weighted pull-up jumps realistic (+4 kg on 75 kg is small).</p>
      <label>
        Kettlebells you own (kg)
        <input value={bells} onChange={(e) => touch(setBells)(e.target.value)} placeholder="e.g. 8, 12, 16" />
      </label>
      <label>
        Smallest plate jump (kg), if you have plates
        <input inputMode="decimal" value={plates} onChange={(e) => touch(setPlates)(e.target.value)} placeholder="e.g. 2.5" />
      </label>
      <label className="row" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={bar} onChange={(e) => touch(setBar)(e.target.checked)} /> Pull-up bar
      </label>
      <label className="row" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={bands} onChange={(e) => touch(setBands)(e.target.checked)} /> Resistance bands
      </label>
      <button className="primary" onClick={() => void save()}>
        {saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </section>
  )
}
