import type { ReactNode } from 'react'
import { Amount } from './amount'
import { Warn } from './glyph'

// The run slip beside the deck: the run's totals with cents and the debit. `net` is the highlighted net pay row,
// `total` the debit under its rule; `alert` is the one red line an exception adds, with Envelope's small tag.
export interface SlipRow { label: string; amount?: string; kind?: 'net' | 'total' }

export function RunSlip({ status, rows, when, alert }: { status: string; rows: SlipRow[]; when: string; alert?: ReactNode }) {
 return <aside className="slip card" aria-labelledby="slip-title">
  <h2 className="slip-title" id="slip-title">Pay run</h2>
  <p className="slip-status">{status}</p>
  <dl className="slip-rows">{rows.map(row => <div key={row.label} className={row.kind && `slip-${row.kind}`}><dt>{row.label}</dt><dd><Amount value={row.amount} /></dd></div>)}</dl>
  <p className="slip-when">{when}</p>
  {alert && <p className="slip-alert"><Warn /><span>{alert}</span><img src="/brand/favicon-16.svg" alt="" width={16} height={16} /></p>}
 </aside>
}
