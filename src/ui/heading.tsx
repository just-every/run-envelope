import type { ReactNode } from 'react'

// The screen heading: two short lines in the heavy rounded face, the first forest and the second teal, then one
// plain line of facts.
export function Heading({ lead, then, meta, id }: { lead: string; then: string; meta?: ReactNode; id?: string }) {
 return <>
  <h1 className="heading" id={id}><span className="lead">{lead}</span>{' '}<span className="then">{then}</span></h1>
  {meta && <p className="heading-meta">{meta}</p>}
 </>
}
