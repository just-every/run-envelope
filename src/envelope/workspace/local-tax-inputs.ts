import type { Actor } from '../access'
import { requireAction } from '../access'
import type { Input } from '../records'
import { PayrollError } from '../security'
import { WorkspaceStore, choice, optional, objectId, revision } from './store'
import { withholdingPeriod } from './allocation-tax'
import type { PittsburghLocalInput } from './pa-local'
import { localExemption, amountOrUnknown } from './local-tax-exemption'

export interface LocalTaxInput {
  from:string;through:string;payDate:string;frequency:string
  ordinaryCashOnly:boolean
  employerState:PittsburghLocalInput['employerState']
  courtesyWithholding:PittsburghLocalInput['courtesyWithholding'];courtesyElectionRef:string
  eitCentRounding:PittsburghLocalInput['eitCentRounding'];eitRoundingEvidenceRef:string
  lst:NonNullable<PittsburghLocalInput['lst']>
  midyearConfirmed:boolean;exemptionKnown:boolean
  owner:string;ownerId:string
}
/** Per-period worker facts; blanks remain unknown. No inferred cap balances or receipts. */
export class LocalTaxInputs {
  constructor(public store:WorkspaceStore) {}
  async save(actor:Actor,personId:string,input:Input) {
    const person = await this.store.records.person(actor,personId)
    requireAction(actor,'private:write',person.locationId,'tax')
    const period=withholdingPeriod(input)
    if (!period) throw new PayrollError('actual_pay_period_required')
    const midyear=choice(input.midyearEntry,['yes','no','unknown'])
    const exemption=localExemption(input)
    const data:LocalTaxInput={...period,
      ordinaryCashOnly:input.ordinaryCashOnly===true||input.ordinaryCashOnly==='true',
      employerState:choice(input.employerState,['NJ','PA','unknown']) as LocalTaxInput['employerState'],
      courtesyWithholding:choice(input.courtesyWithholding,['elected','declined','unknown']) as LocalTaxInput['courtesyWithholding'],
      courtesyElectionRef:optional(input.courtesyElectionRef,500),
      eitCentRounding:choice(input.eitCentRounding ?? 'unknown',['nearest-half-up','unknown']) as LocalTaxInput['eitCentRounding'],
      eitRoundingEvidenceRef:optional(input.eitRoundingEvidenceRef,500),
      midyearConfirmed:midyear!=='unknown',exemptionKnown:exemption.known,
      lst:{principalEmployer:choice(input.principalEmployer,['this','other','unknown']) as NonNullable<PittsburghLocalInput['lst']>['principalEmployer'],
        principalWorkPsd:optional(input.principalWorkPsd,6),principalEmploymentEvidenceRef:optional(input.principalEmploymentEvidenceRef,500),
        payrollPeriodsPerYear:amountOrUnknown(input.payrollPeriodsPerYear) ?? 0,
        priorCollectedCents:amountOrUnknown(input.priorCollectedCents),priorCollectionEvidenceRef:optional(input.priorCollectionEvidenceRef,500),
        periodCollectedCents:amountOrUnknown(input.periodCollectedCents),periodCollectionEvidenceRef:optional(input.periodCollectionEvidenceRef,500),
        employerPittsburghYtdCents:amountOrUnknown(input.employerPittsburghYtdCents),ytdEvidenceRef:optional(input.ytdEvidenceRef,500),
        midyearEntry:midyear==='yes',exemptionCatchupPeriods:amountOrUnknown(input.exemptionCatchupPeriods),
        catchupEvidenceRef:optional(input.catchupEvidenceRef,500),restorationNoticeRef:optional(input.restorationNoticeRef,500),exemption:exemption.value},
      owner:actor.session.operator.displayName,ownerId:actor.session.operator.id}
    return this.store.append(actor,'local-tax-input',objectId(input.id),revision(input.version),data,personId,true)
  }
}
