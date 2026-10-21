import { HydrationUnit } from '../base/hydration/unit'
import { AppBar } from './bar'
import { Heading } from './heading'

// Any address the app does not have, in the app's shell.
export function NotFound() {
 return <div className="app">
  <HydrationUnit><div className="app-wrap"><AppBar home="/" /></div></HydrationUnit>
  <main className="app-wrap lost">
   <HydrationUnit><section className="lost-card card" aria-labelledby="lost-title">
    <Heading id="lost-title" lead="Page not found." then="Nothing is filed here." />
    <p className="lost-body">This address is not part of Envelope. Pay runs, people and settings start from the app.</p>
    <div className="choices"><a className="btn btn--primary" href="/app">Open Envelope →</a></div>
   </section></HydrationUnit>
  </main>
 </div>
}
