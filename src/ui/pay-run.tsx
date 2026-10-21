import { identity } from '../identity'
import { AppBar } from './bar'
import { ClientChips } from './chips'
import { Check, Deck, Tag, type PayLine } from './deck'
import { Heading } from './heading'
import { RunSlip, type SlipRow } from './slip'
import type { Viewer } from './viewer'

// The open check's lines and the slip's rows as the pick names them (its places dropped: no business is open); with
// no run open each figure is a dash.
const EARNINGS: PayLine[] = [{ label: 'Regular hours' }, { label: 'Overtime hours' }]
const DEDUCTIONS: PayLine[] = [{ label: '401(k)' }, { label: 'Social Security' }, { label: 'Medicare' }, { label: 'Federal income tax' }, { label: 'State tax' }, { label: 'Local tax' }]
const SLIP: SlipRow[] = [
 { label: 'Gross pay' }, { label: 'Employee taxes' }, { label: '401(k) contributions' },
 { label: 'Net pay', kind: 'net' }, { label: 'Employer taxes' }, { label: 'Total debit', kind: 'total' },
]

// The app home: the signed-in person's pay run (owner pick A). Payroll is not built yet (CONTRACT.md: every clause
// missing), so this is the screen's empty state in the pick's composition: no businesses in the chips, an empty open
// check in front of the deck, the slip with no run, and choices that open what exists today.
export function PayRunHome({ viewer }: { viewer: Viewer }) {
 return <>
  <div className="app-wrap"><AppBar viewer={viewer} /></div>
  <main className="app-wrap">
   <ClientChips clients={[]} />
   <div className="payrun">
    <div className="payrun-head"><Heading lead="No pay runs yet." then="Payroll is still being built." meta="No businesses · no people · no pay run open" /></div>
    <Deck label="Paychecks">
     <Check titleId="check-title" avatar={<span className="avatar avatar--empty" aria-hidden="true" />}
      name="No paychecks yet" role="Each person's paycheck will open here, gross to net." earnings={EARNINGS} deductions={DEDUCTIONS}
      tag={<Tag>Sign-in, setup and settings work today. Businesses, people and pay runs are in the contract, not built yet.</Tag>}
      choices={<div className="choices"><a className="btn btn--primary" href={`${identity.runSite}/contract`}>See what's built →</a><a className="btn" href={`${identity.runSite}/docs`}>Read the docs</a></div>} />
    </Deck>
    <RunSlip status="No run open" rows={SLIP} when="No debit scheduled" />
   </div>
  </main>
 </>
}
