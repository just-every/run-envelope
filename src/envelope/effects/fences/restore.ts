import type { Records } from '../../records'
import type { Actor } from '../../access'
import { PayrollError } from '../../security'

/** Restore never reactivates historical authority or uncertain external work. */
export async function requireActiveCompany(records:Records,actor:Actor) {
  const company=await records.statement('SELECT restored FROM env_companies WHERE id=?',[actor.company]).first<{restored:number}>()
  if(!company || company.restored) throw new PayrollError('restored_company_read_only_reconciliation_required',409)
}

/** Historical run approvals cannot appear current while their company is inactive. */
export const activeCompanySql=(companyColumn:string)=>`EXISTS(SELECT 1 FROM env_companies restored_company WHERE restored_company.id=${companyColumn} AND restored_company.restored=0)`
