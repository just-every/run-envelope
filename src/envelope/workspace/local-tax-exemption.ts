import type { Input } from '../records'
import { choice, optional } from './store'
import type { PittsburghLocalInput } from './pa-local'
import { PayrollError } from '../security'
export const amountOrUnknown = (v: unknown) => {
  if (v === undefined || v === '' || v === null) return null
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v
  if (!Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 100000000)
    throw new PayrollError('invalid_local_tax_amount')
  return Number(n)
}

export function localExemption(input:Input) {
  const status=choice(input.exemptionStatus,['unknown','none','low-income','multiple-employers','active-duty','military-disability'])
  if (status==='unknown'||status==='none') return {known:status==='none',value:null}
  const confirmed=(key:string) => input[key]===true||input[key]==='true'
  const value:NonNullable<NonNullable<PittsburghLocalInput['lst']>['exemption']>={
    reason:status as 'low-income'|'multiple-employers'|'active-duty'|'military-disability',
    year:amountOrUnknown(input.exemptionYear) ?? 0,
    certificateRef:optional(input.exemptionCertificateRef,500),supportingEvidenceRef:optional(input.exemptionSupportingRef,500),
    filedWithEmployer:confirmed('exemptionFiledEmployer'),filedWithCity:confirmed('exemptionFiledCity'),
    currentEligibility:confirmed('exemptionCurrentlyEligible'),expectedPittsburghAnnualCents:amountOrUnknown(input.expectedPittsburghAnnualCents),
    principalPayStatementRef:optional(input.principalPayStatementRef,500),principalEmployeeStatementRef:optional(input.principalEmployeeStatementRef,500),
    principalPeriodLstCents:amountOrUnknown(input.principalPeriodLstCents),
  }
  return {known:true,value}
}
