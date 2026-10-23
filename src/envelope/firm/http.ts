import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Records, Company, Input } from '../records'
import { PayrollError } from '../security'
import { companyPath } from '../pages'
import { firmDashboard } from './dashboard'
import { prepareBatch } from './batch'
import { firmPage } from './pages'
import { FirmWork } from './work'
import { firmSettingsPage, firmWorkPage, firmWorkDetail } from './work-pages'
const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
const redirect = (location: string) => new Response(null, { status: 303, headers: { ...headers, location } })
interface Context { url: URL; ui: boolean; post: boolean; parts: string[]; value: Input; records: Records; session: Session; companies: Company[] }
async function respond({url,ui,post,parts,value,records,session,companies}: Context): Promise<Response | null> {
  if (parts[0] === 'firm') {
    if (parts.length === 1 && !post) {
      const view = await firmDashboard(records, url.searchParams)
      return ui ? firmPage(session,view) : json(view)
    }
    if (parts.length === 2 && parts[1] === 'prepare' && post) {
      const result = await prepareBatch(records,value)
      return ui ? firmPage(session,await firmDashboard(records,new URLSearchParams()),result) : json(result)
    }
    throw new PayrollError('not_found',404)
  }
  if (parts[0] !== 'companies' || !['firm-work','firm-settings'].includes(parts[2])) return null
  const actor = await records.actor(parts[1]), work = new FirmWork(records), base = companyPath(actor.company)
  if (parts[2] === 'firm-settings' && parts.length === 3) {
    if (post) { const saved = await work.configure(actor,value); return ui ? redirect(base + '/firm-settings') : json(saved) }
    const settings = await work.settings(actor)
    return ui ? firmSettingsPage(session,companies,actor,settings) : json(settings)
  }
  if (parts[2] !== 'firm-work') throw new PayrollError('not_found',404)
  if (parts.length === 3) {
    if (post) { const saved = await work.save(actor,value); return ui ? redirect(base + '/firm-work/' + saved.id) : json(saved,201) }
    const items = await work.list(actor)
    return ui ? firmWorkPage(session,companies,actor,items,await work.people(actor),url.searchParams) : json(items)
  }
  if (parts.length === 4 && !post) {
    const item = (await work.list(actor)).find(w => w.id === parts[3])
    if (!item) throw new PayrollError('work_unavailable',403)
    const history = await work.history(actor,item.id)
    return ui ? firmWorkDetail(session,companies,actor,item,await work.people(actor),history,await work.settings(actor)) : json({item,history})
  }
  if (parts.length === 5 && post) {
    const saved = parts[4] === 'delegate' ? await work.delegate(actor,parts[3],value) : parts[4] === 'handoff' ? await work.handoff(actor,parts[3],value) : parts[4] === 'acknowledge' ? await work.acknowledge(actor,parts[3],value) : null
    if (!saved) throw new PayrollError('not_found',404)
    return ui ? redirect(base + '/firm-work/' + parts[3]) : json(saved)
  }
  throw new PayrollError('not_found',404)
}

export async function firmResponse(context: Context): Promise<Response | null> {
  try { return await respond(context) } catch (error) {
    const message = error instanceof Error ? error.message : ''
    for (const code of ['firm_work_recipient_required','firm_work_owner_required'])
      if (message.includes(code)) throw new PayrollError(code,409)
    throw error
  }
}
