// Hash routes: #/, #/settings, #/share, #/join?p=…, #/w/<window>[/<exercise>]

export type Route =
  | { name: 'landing' }
  | { name: 'settings' }
  | { name: 'share' }
  | { name: 'join'; payload: string }
  | { name: 'window'; windowId: string; exerciseId?: string }

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'share') return { name: 'share' }
  if (parts[0] === 'join') return { name: 'join', payload: new URLSearchParams(query).get('p') ?? '' }
  if (parts[0] === 'w' && parts[1]) return { name: 'window', windowId: parts[1], exerciseId: parts[2] }
  return { name: 'landing' }
}
