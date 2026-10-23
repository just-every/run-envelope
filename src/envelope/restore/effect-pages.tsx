import type {Session} from '../../modules/operator-auth/index.mjs'
import type {Company} from '../records'
import type {Actor} from '../access'
import type {RestoredEffects} from './effects'
import {page,Card,Field,Hidden,Submit,companyPath} from '../pages'
export function restoredEffectsPage(session:Session,companies:Company[],actor:Actor,work:Awaited<ReturnType<RestoredEffects['list']>>) {
  const base=companyPath(actor.company)+'/restore'
  return page(session,'Reconcile original notice IDs',companies,actor.company,<>
    <Card title="Fresh lookup connection — no sending">
      <p className="evidence-text">Explicit consent allows GET https://api.resend.com/emails/:id for a recorded original ID only. The lookup sends that ID and the fresh API credential, compares the original sender, recipient, subject and text, and records current provider evidence. It never resends, creates delivery or agency closure, or activates this company. Unknown sends without an original ID stay held for provider investigation.</p>
      <form method="post" action="/auth/step-up"><Hidden name="action" value="credentials:mint" /><Hidden name="returnTo" value={base} /><Submit>Send reconciliation confirmation</Submit></form>
      <form method="post" action={base+'/providers'}>
        <Hidden name="id" value="resend" /><Hidden name="version" value={work.provider?.version??0} />
        <label className="field"><span>Restore lookup connection state</span><select name="enabled" aria-label="Restore lookup connection state" defaultValue={work.provider?.enabled?'true':'false'}><option value="false">Disabled</option><option value="true">Enabled with fresh consent</option></select></label>
        <Field name="secret" label="Fresh Resend API credential (empty to retain)" type="password" required={false} maxLength={4096} />
        <Field name="sender" label="Verified sender for any future separately approved correspondence" type="email" value={work.provider?.sender} required={false} />
        <label className="field"><span><input type="checkbox" name="consent" value="true" /> I authorize the declared Resend correspondence purpose; all sending remains paused.</span></label>
        <label className="field"><span><input type="checkbox" name="reconcileConsent" value="true" /> I separately authorize lookup of recorded original notice email IDs.</span></label>
        <Submit>Save fresh restore lookup consent</Submit>
      </form>
    </Card>
    <Card title="Recorded original effects">
      {work.effects.length ? work.effects.map(e=><div key={e.id}><p className="evidence-text">Intent {e.id}. Original state: {e.state}. Original provider ID: {e.providerReceipt??'Unknown — do not resend'}. {e.checkedAt?`Verified with this fresh connection at ${new Date(e.checkedAt).toISOString()}; observed provider event ${e.observedEvent}.`:'No current lookup proof.'}</p>
        {e.state==='accepted' && !e.checkedAt && <form method="post" action={base+'/reconcile'}><Hidden name="dispatchId" value={e.id} /><Submit>Verify this original provider ID</Submit></form>}
      </div>):<p className="evidence-text">No original notice dispatch intents.</p>}
    </Card>
  </>)
}
