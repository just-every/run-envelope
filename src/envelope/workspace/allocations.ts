import type { Input } from '../records'
import { date, text, integer, PayrollError } from '../security'
import type { Actor } from '../access'
import { states } from '../setup'
import { WorkspaceStore, choice, optional, objectId, revision, type Revision } from './store'

export const allocationRules = {
  reciprocity: { id:'nj-pa-wages-2026-09-28', title:'NJ Division of Taxation: PA/NJ reciprocal wage agreement and NJ-165 / REV-419EX', url:'https://www.nj.gov/treasury/taxation/njit25.shtml' },
  newYork: { id:'ny-tsbm-06-5i', title:'New York TSB-M-06(5)I: nonresident convenience of the employer', url:'https://www.tax.ny.gov/pdf/memos/income/m06_5i.pdf' },
  newJersey: { id:'nj-njwt-source', title:'New Jersey employer withholding instructions', url:'https://www.nj.gov/treasury/taxation/pdf/current/njwt.pdf' },
  pennsylvania: { id:'pa-resident-compensation', title:'Pennsylvania personal income tax guide: compensation', url:'https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/personal-income-tax/personal-income-tax-guide/gross-compensation.html' },
  local: { id:'pa-local-eit', title:'Pennsylvania DCED: local income tax requirements for employers', url:'https://dced.pa.gov/local-government/local-income-tax-information/local-income-tax-requirements-for-employers/' },
} as const
export interface Residence { from:string; through:string; state:string; locality:string; evidence:string; owner:string }
export interface WorkDay { day:string; state:string; locality:string; minutes:number; earnedCents:number; officeState:string; nyReason:string; evidence:string; sourceRef:string; owner:string }
export interface Election { from:string; through:string; residentState:string; workState:string; form:string; evidence:string; owner:string }
const range = (input: Input) => {
  const from = date(input.from), through = date(input.through)
  if (from > through) throw new PayrollError('invalid_effective_range')
  return { from,through }
}
const state = (v:unknown) => choice(v,states)
const current = <T>(rows:Revision<T>[]) => rows.filter((r,i,a) => a.findIndex(x=>x.id===r.id)===i)
export class Allocations {
  constructor(public store:WorkspaceStore) {}
  async save(actor:Actor, personId:string, kind:'residence'|'work'|'election', input:Input) {
    const id = objectId(input.id), version = revision(input.version), owner = text(input.owner,120)
    let data: Residence | WorkDay | Election
    if (kind === 'residence') data = { ...range(input),state:state(input.state),locality:text(input.locality,120),evidence:text(input.evidence,500),owner }
    else if (kind === 'work') {
      const minutes = integer(input.minutes), earnedCents = input.earnedCents === 0 || input.earnedCents === '0' ? 0 : integer(input.earnedCents)
      if (minutes > 1440) throw new PayrollError('invalid_work_minutes')
      const officeState = state(input.officeState), nyReason = choice(input.nyReason,['not-applicable','convenience','employer-necessity','undetermined']), evidence = optional(input.evidence,500)
      if (officeState === 'NY' && nyReason === 'employer-necessity' && !evidence) throw new PayrollError('necessity_evidence_required')
      data = { day:date(input.day),state:state(input.state),locality:text(input.locality,120),minutes,earnedCents,officeState,nyReason,evidence,sourceRef:text(input.sourceRef,240),owner }
    } else {
      const residentState = state(input.residentState), workState = state(input.workState)
      if (!((residentState==='PA'&&workState==='NJ')||(residentState==='NJ'&&workState==='PA'))) throw new PayrollError('reciprocity_rule_not_implemented')
      const form = choice(input.form,['NJ-165','REV-419EX'])
      if (form !== (residentState==='PA'?'NJ-165':'REV-419EX')) throw new PayrollError('election_scope_conflict')
      data = { ...range(input),residentState,workState,form,evidence:text(input.evidence,500),owner }
    }
    return this.store.append(actor,kind,id,version,data,personId,kind==='work')
  }
  async read(actor:Actor,personId:string) {
    await this.store.authority(actor,'records:read',personId,true)
    const residence = await this.store.list<Residence>(actor,'residence',personId)
    const work = await this.store.list<WorkDay>(actor,'work',personId,true)
    const elections = await this.store.list<Election>(actor,'election',personId)
    return { residence,work,elections,rules:allocationRules }
  }
  async preview(actor:Actor,personId:string,input:Input) {
    const from = date(input.from), through = date(input.through)
    if (from>through || (Date.parse(through)-Date.parse(from))/86400000 > 366) throw new PayrollError('invalid_preview_period')
    const history = await this.read(actor,personId)
    const holds:{day:string;reason:string;owner:string;sourceIds:string[]}[] = []
    const allocations:{day:string;earnedCents:number;physicalWorkState:string;residentState:string;stateWageBases:{state:string;basisCents:number;role:string}[];localities:string[];ruleIds:string[];sourceIds:string[];electionId:string|null}[] = []
    const residents=current(history.residence), work=current(history.work).filter(r=>r.data.day>=from&&r.data.day<=through), elections=current(history.elections)
    if (!work.length) holds.push({day:from,reason:'No sourced work allocations in the period.',owner:actor.session.operator.displayName,sourceIds:[]})
    for (const row of work) {
      const w=row.data, rs=residents.filter(r=>r.data.from<=w.day&&r.data.through>=w.day), sources=[row.id+':'+row.version,...rs.map(r=>r.id+':'+r.version)]
      const hold=(reason:string) => holds.push({day:w.day,reason,owner:w.owner,sourceIds:sources})
      if (rs.length!==1) {hold(rs.length?'Contradictory residence sources. Review overlapping effective locations.':'Residence is unknown on this work date.');continue}
      const r=rs[0].data
      if (work.filter(x=>x.data.day===w.day).reduce((n,x)=>n+x.data.minutes,0)>1440) {hold('Contradictory work allocations exceed 24 hours.');continue}
      if (![r.state,w.state,w.officeState].every(s=>['NJ','PA','NY'].includes(s))) {hold('Official state allocation rule is not implemented for every recorded state.');continue}
      const applicable=elections.filter(e=>e.data.from<=w.day&&e.data.through>=w.day&&e.data.residentState===r.state&&e.data.workState===w.state)
      if (applicable.length>1) {hold('Contradictory overlapping reciprocity elections.');continue}
      const e=applicable[0], bases:{state:string;basisCents:number;role:string}[]=[],ruleIds:string[]=[]
      const add=(state:string,role:string)=>{const existing=bases.find(b=>b.state===state);if(existing)existing.role+='; '+role;else bases.push({state,basisCents:w.earnedCents,role})}
      add(r.state,'resident wage base (credit/withholding calculation still required)')
      ruleIds.push(r.state==='PA'?allocationRules.pennsylvania.id:r.state==='NJ'?allocationRules.newJersey.id:allocationRules.newYork.id)
      if (e) {ruleIds.push(allocationRules.reciprocity.id);sources.push(e.id+':'+e.version)}
      else add(w.state,'physical work wage base')
      if (w.officeState==='NY' && w.state!=='NY' && r.state!=='NY') {
        ruleIds.push(allocationRules.newYork.id)
        if (w.nyReason==='convenience') add('NY','NY assigned office: convenience day')
        else if (w.nyReason!=='employer-necessity'||!w.evidence) {hold('New York convenience/necessity determination is unresolved.');continue}
      }
      const localities=[...new Set([r.locality,w.locality])]
      if (r.state==='PA'||w.state==='PA') {
        ruleIds.push(allocationRules.local.id)
        hold('PA local EIT/LST applicability, resident/nonresident rates and employer withholding remain unresolved; reciprocity does not waive local taxes.')
      }
      // These are jurisdiction wage bases, not additive liabilities or a gross-to-net calculation.
      allocations.push({day:w.day,earnedCents:w.earnedCents,physicalWorkState:w.state,residentState:r.state,stateWageBases:bases,localities,ruleIds:[...new Set(ruleIds)],sourceIds:sources,electionId:e?.id??null})
    }
    return {from,through,personId,allocations,holds,totalWorkCents:work.reduce((s,r)=>s+r.data.earnedCents,0),allocatedWorkCents:allocations.reduce((s,r)=>s+r.earnedCents,0),
      status:'allocation-preview-only',paymentReady:false,taxAmounts:null,netPay:null,
      explanation:'State wage bases may overlap for resident and source taxation. They are not amounts to add together. No manual balancing adjustment is applied. Full state/local withholding, credits, reporting and net pay remain uncalculated.',history,rules:allocationRules}
  }
}
