import type { ReactNode } from 'react'
import { Amount } from './amount'

// The deck (owner pick A): a run's paychecks, the open one in front and the others fanned behind it.
export function Deck({ label, children }: { label: string; children: ReactNode }) {
 return <section className="deck" aria-label={label}>
  <div className="deck-fan" aria-hidden="true"><span /><span /><span /><span /><span /></div>
  {children}
 </section>
}

export interface PayLine { label: string; amount: string }

const lines = (items: PayLine[]) => items.length
 ? items.map(item => <p key={item.label} className="check-line"><span>{item.label}</span><span>{item.amount}</span></p>)
 : <p className="check-line"><Amount /></p>

// One person's paycheck, gross to net: who, hours and pay, deductions and taxes and net pay. The open check also
// carries Envelope's tag and the person's choices.
export function Check({ titleId, avatar, name, role, earnings, gross, deductions, net, tag, choices }: {
 titleId: string; avatar: ReactNode; name: string; role: string; earnings: PayLine[]; gross?: string; deductions: PayLine[]; net?: string; tag?: ReactNode; choices?: ReactNode
}) {
 return <article className="check card" aria-labelledby={titleId}>
  <header className="check-head">{avatar}<div><h2 className="check-name" id={titleId}>{name}</h2><p className="check-role">{role}</p></div></header>
  <div className="check-cols">
   <section className="check-col" aria-label="Hours and pay"><h3 className="check-label">Hours and pay</h3>{lines(earnings)}<p className="check-gross"><span>Gross pay</span><Amount value={gross} /></p></section>
   <section className="check-col" aria-label="Deductions and taxes"><h3 className="check-label">Deductions and taxes</h3>{lines(deductions)}</section>
  </div>
  <div className="check-foot">{tag}<p className="check-net"><span>Net pay</span><Amount value={net} /></p></div>
  {choices}
 </article>
}

// Envelope's tag: what a person must read on a check or the slip, beside mark 9's small cut, ending in a choice.
export function Tag({ children }: { children: ReactNode }) {
 return <p className="tag"><img src="/favicon-32.svg" alt="" width={36} height={36} /><span>{children}</span></p>
}
