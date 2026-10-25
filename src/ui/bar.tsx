import branding from '../branding.json'
import { initials, roleLine, type Viewer } from './viewer'

// The app's one slim floating bar (owner pick A): mark 9 and the wordmark at left, then what the signed-in person
// can open. Search and Ask Envelope take the right side when the product has them (docs/LOOK.md).
export function AppBar({ viewer, home = '/app', language = 'en' }: { viewer?: Viewer; home?: string; language?: 'en' | 'es' }) {
 const currentRole = viewer && roleLine(viewer)
 const role = language === 'es' && currentRole ? ({Owner:'Propietario',Admin:'Administrador',Member:'Miembro'} as Record<string,string>)[currentRole] ?? currentRole : currentRole
 return <header className="bar">
  <a className="lockup" href={home}><img src="/brand/mark.svg" alt="" width={40} height={40} /><span data-rer-name>{branding.name}</span></a>
  {viewer && <div className="bar-end">
   {viewer.role === 'owner' && <a className="bar-link" href="/app/envelope">{language === 'es' ? 'Configuración' : 'Settings'}</a>}
   <p className="person"><span className="avatar" aria-hidden="true">{initials(viewer.displayName)}</span><span className="person-name"><b>{viewer.displayName}</b>{role && <small>{role}</small>}</span></p>
  </div>}
 </header>
}
