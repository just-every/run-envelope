// Client chips: one per business the person runs payroll for, a solid pill in the business's colour with its name
// in white and the run's status; the open business carries aria-current. Never a category icon.
export type ChipColour = 'goldenrod' | 'forest' | 'teal' | 'slate' | 'violet'
export interface ClientChip { name: string; status: string; colour: ChipColour; href: string; open?: boolean }

export function ClientChips({ clients }: { clients: ClientChip[] }) {
 return <nav className="chips" aria-label="Businesses">
  {clients.length ? clients.map(client => <a key={client.href} className={`chip chip--${client.colour}`} href={client.href} aria-current={client.open ? 'page' : undefined}><b>{client.name}</b><small>{client.status}</small></a>)
   : <p className="chip chip--none"><b>No businesses yet</b><small>Adding a business isn't built yet</small></p>}
 </nav>
}
