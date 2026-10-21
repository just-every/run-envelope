// The signed-in person as the app shows them: name, initials and role.
export interface Viewer { displayName: string; email: string; role: string }

const ROLES: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const roleLabel = (role: string) => ROLES[role] ?? role

/** The role shown under the name, or nothing when the name already reads as it ("Owner" signed in as the owner). */
export const roleLine = ({ displayName, role }: Viewer) => { const label = roleLabel(role); return label.toLowerCase() === displayName.trim().toLowerCase() ? '' : label }

/** "Kim Sorensen" → "KS"; one name gives one letter. */
export const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => [...part][0].toUpperCase()).join('') || '?'
