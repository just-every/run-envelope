import { date, PayrollError } from '../security'
import { choice, type Revision } from './store'
import { periodEnd } from './schedules'
import { paWithholding } from './pa-withholding'
import { njWithholding, type NjWithholdingInput } from './nj-withholding'
import { nyWithholding, type NyWithholdingInput } from './ny-withholding'
import { pittsburghLocal, pittsburghSources, type PittsburghLocalInput } from './pa-local'
import type { Actor } from '../access'
import type { Input } from '../records'
import type { TaxElection } from './tax-elections'
import type { LocalTaxInput } from './local-tax-inputs'

type Allocation = Parameters<typeof paWithholding>[0][number] & {
  residencePsd:string; residenceSchoolDistrict:string; residencyCertificationRef:string
  workPsd:string; site:string; physicalWorkEvidenceRef:string; sourceIds:string[]
}
interface StateTax {
  state:string;taxableWagesCents:number;reportWagesCents:number;withholdingCents:number|null
  source:{id:string;title:string;url:string};determination:string;holds:string[];explanation:string
  inputRef?:string;calculation?:unknown
}
const latest = <T>(rows:Revision<T>[]) => rows.filter((r,i,a) => a.findIndex((p) => p.id === r.id) === i)
export function withholdingPeriod(input: Input) {
  if (!input.payDate) return undefined
  const from = date(input.from), through = date(input.through), payDate = date(input.payDate)
  const frequency = choice(input.frequency, ['weekly','biweekly','semimonthly','monthly'])
  if (periodEnd(from, frequency) !== through) throw new PayrollError('actual_pay_period_required')
  return {from,through,payDate,frequency}
}
export function allocationTax(actor: Actor, period:ReturnType<typeof withholdingPeriod>,
  allocations:Allocation[],totalCents:number,allocatedCents:number,
  elections:Revision<TaxElection>[],localInputs:Revision<LocalTaxInput>[]) {
  if (!period) return undefined
  const pa = paWithholding(allocations,period.from,period.through,period.payDate)
  const states:StateTax[] = [{...pa}]
  for (const state of ['NJ','NY'] as const) {
    const wages = allocations.reduce((n,a) => n + (a.stateWageBases.find((b) => b.state === state)?.basisCents ?? 0),0)
    const source = state === 'NJ' ? {id:'nj-wt-current-percentage-2026',title:'NJ-WT and linked percentage tables',url:'https://www.nj.gov/treasury/taxation/pdf/current/njwt.pdf'} :
      {id:'ny-nys50-t-nys-2026-01',title:'NYS-50-T-NYS (1/26), Methods II/III',url:'https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf'}
    const result:StateTax = {state,source,taxableWagesCents:wages,reportWagesCents:wages,
      withholdingCents:null,determination:'unresolved',holds:[],explanation:'Ordinary regular cash wages only. Complete state taxability, certificate custody, local taxes and net pay remain unresolved.'}
    states.push(result)
    if (wages === 0) {result.withholdingCents=0;result.determination='no-recorded-state-wages';continue}
    const rows = latest(elections.filter((e) => e.data.state === state && e.data.from <= period.payDate && e.data.through >= period.payDate))
    if (rows.length !== 1 || !rows[0].sourcesCurrent) {
      result.holds.push('One current, unambiguous sourced '+state+' withholding election is required.');continue
    }
    const election = rows[0].data
    result.inputRef=rows[0].id+':'+rows[0].version
    if (allocations.some((a) => a.residentState === state && a.stateWageBases.some((b) => b.state !== state))) {
      result.holds.push('Resident reduction for required other-state withholding must be resolved before this state amount.');continue
    }
    try {
      if (state === 'NJ') {
        const calculated = njWithholding({taxableWagesCents:wages,frequency:period.frequency as NjWithholdingInput['frequency'],payDate:period.payDate,
          table:election.table as NjWithholdingInput['table'],allowances:election.allowances,additionalCents:election.additionalCents})
        Object.assign(result,{source:calculated.source,withholdingCents:calculated.withholdingCents,calculation:calculated.calculation,explanation:calculated.explanation})
      } else {
        const calculated = nyWithholding({taxableWagesCents:wages,frequency:period.frequency as NyWithholdingInput['frequency'],payDate:period.payDate,
          filingStatus:election.filingStatus as NyWithholdingInput['filingStatus'],allowances:election.allowances,additionalCents:election.additionalCents})
        Object.assign(result,{withholdingCents:calculated.withholdingCents,calculation:calculated.calculation,explanation:calculated.explanation})
      }
      result.determination='calculated-preview'
    } catch(error) {
      result.holds.push(error instanceof Error && /^(nj_|ny_)/.test(error.message) ? error.message : 'State withholding calculation requires review.')
    }
  }
  if (allocatedCents !== totalCents) for (const tax of states) {
    tax.holds.push('Unresolved work or residence leaves part of the period unallocated. Resolve those assigned sources before computing state withholding.')
    tax.withholdingCents=null;tax.determination='unresolved'
  }
  const localRows=latest(localInputs).filter((r) => r.data.from===period.from && r.data.through===period.through && r.data.payDate===period.payDate)
  let local:ReturnType<typeof pittsburghLocal>
  const facts=localRows.length===1 && localRows[0].sourcesCurrent ? localRows[0].data : undefined
  const source:NonNullable<PittsburghLocalInput['source']>={edition:pittsburghSources.edition,evidenceRef:pittsburghSources.register,
    verifiedOn:'2026-10-22',effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',psd:'700102',municipality:'PITTSBURGH CITY',
    schoolDistrict:'PITTSBURGH S D',schoolDistrictId:'027451',residentCityBps:100,residentSchoolBps:200,nonresidentBps:100,
    lstAnnualCents:5200,lstSchoolCents:0,lstLowIncomeCents:1200000}
  if (!facts || allocatedCents !== totalCents) {
    local={eitCents:null,eitLiabilityCents:null,eitExact:null,lstCents:null,holds:[{code:'pa-local-period-proof-required',reason:'Current per-period principal-employer, LST balances/exemption applicability and complete sourced allocations are required.'}],detail:[],provenance:{sources:pittsburghSources,evidenceRef:source.evidenceRef,verifiedOn:source.verifiedOn}}
  } else {
    local=pittsburghLocal({payDate:period.payDate,periodStart:period.from,periodEnd:period.through,ordinaryCashOnly:facts.ordinaryCashOnly,
      foreignTaxCreditClaim:allocations.some((a) => a.stateWageBases.some((b) => !['NJ','PA'].includes(b.state))),
      eitCentRounding:facts.eitCentRounding,eitRoundingEvidenceRef:facts.eitRoundingEvidenceRef,employerState:facts.employerState,courtesyWithholding:facts.courtesyWithholding,
      courtesyElectionRef:facts.courtesyElectionRef,source,
      days:allocations.map((a) => ({day:a.day,sourceId:a.sourceIds[0],ordinaryCashCents:a.earnedCents,
        residentState:['NJ','PA'].includes(a.residentState) ? a.residentState as 'NJ'|'PA' : 'unknown',
        residencePsd:a.residencePsd,residenceSchoolDistrict:a.residenceSchoolDistrict,residencyCertificationRef:a.residencyCertificationRef,
        physicalWorkState:['NJ','PA'].includes(a.physicalWorkState) ? a.physicalWorkState as 'NJ'|'PA' : 'unknown',
        workPsd:a.workPsd,site:a.site as PittsburghLocalInput['days'][number]['site'],physicalWorkEvidenceRef:a.physicalWorkEvidenceRef})),
      lst:facts.midyearConfirmed && facts.exemptionKnown ? facts.lst : null})
  }
  return {...period,states,local:{...local,eitExact:local.eitExact ? {numerator:local.eitExact.numerator.toString(),denominator:local.eitExact.denominator.toString()} : null},
    owner:actor.session.operator.displayName,ownerId:actor.session.operator.id,status:'ordinary-cash-preview-only',paymentReady:false}
}
