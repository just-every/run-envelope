import type { Actor } from '../access'
import type { Input } from '../records'
import { integer, PayrollError, text } from '../security'
import { WorkspaceStore, digest, revision, type Revision } from '../workspace/store'
import { retirementCalculationPreview, type PreviewInput } from '../calculation/preview'
import { retirementElection, type RetirementElection } from './retirement'

interface Proposal {
  electionId: string; electionVersion: number; sourceRef: string; payroll: PreviewInput
  result: ReturnType<typeof retirementCalculationPreview>; correctionReason: string
  correctsVersion: number | null; impact: {employeeDifferenceCents:number;employerMatchDifferenceCents:number} | null
}
export class RetirementRecords {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, personId: string) {
    // Interim conservative authority: no delegated, agent, outbound or effect permission is inferred.
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) throw new PayrollError('owner_required',403)
    await this.store.authority(actor,'records:read',personId,true)
  }
  id(personId: string) { return 'retirement-'+personId }
  async list(actor: Actor, personId: string) {
    await this.scope(actor,personId)
    const elections=await this.store.list<RetirementElection>(actor,'retirement-election',personId,true)
    const proposals=await this.store.list<Proposal>(actor,'retirement-preview',personId,true)
    const current=elections[0]
    const active=current && current.sourcesCurrent && current.approvedBy && !current.withdrawnBy
      ? await this.store.records.statement('SELECT 1 WHERE '+this.reviewAuthority(actor,current).sql,this.reviewAuthority(actor,current).args).first() : null
    return {elections,proposals:proposals.map((p,i)=>({...p,preparationCurrent:Boolean(active && p.sourcesCurrent
      && p.data.electionVersion===current.version && proposals.findIndex(r=>r.id===p.id)===i)}))}
  }
  async save(actor: Actor, personId: string, input: Input) {
    await this.scope(actor,personId)
    if (Object.keys(input).some(k=>!['version','election'].includes(k))) throw new PayrollError('invalid_retirement_input')
    const election=retirementElection(input.election)
    return this.store.append(actor,'retirement-election',this.id(personId),revision(input.version),election,personId,true,{noPrivacyHold:personId})
  }
  async review(actor: Actor, personId: string) {
    await this.scope(actor,personId)
    return this.store.review<RetirementElection>(actor,'retirement-election',this.id(personId),personId)
  }
  async approve(actor: Actor, personId: string, input: Input) {
    await this.scope(actor,personId)
    return this.store.decide(actor,'retirement-election',this.id(personId),input,personId,input.withdraw===true)
  }
  private reviewAuthority(actor: Actor, election: Revision<RetirementElection>) {
    // Retained decisions have no live authority after restore, grant change or reviewer revocation.
    return {sql:`EXISTS(SELECT 1 FROM env_workspace_reviews r JOIN oa_sessions s ON s.id=r.session_id JOIN oa_operators o ON o.id=r.operator_id
      JOIN env_grants g ON g.company_id=r.company_id AND g.operator_id=r.operator_id
      WHERE r.company_id=? AND r.kind='retirement-election' AND r.object_id=? AND r.version=? AND r.operator_id=?
      AND g.version=r.grant_version AND g.revoked_at IS NULL AND g.role='owner' AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000
      AND s.operator_id=o.id AND s.operator_version=o.version AND o.status='active' AND o.role='owner' AND s.kind='native')`,
      args:[actor.company,election.id,election.version,election.approvedBy!]}
  }
  async preview(actor: Actor, personId: string, input: Input) {
    await this.scope(actor,personId)
    if (Object.keys(input).some(k=>!['version','electionVersion','sourceRef','payroll','correctionReason'].includes(k))) throw new PayrollError('invalid_retirement_input')
    const election = await this.store.find<RetirementElection>(actor,'retirement-election',this.id(personId),personId,true)
    if (election.version!==integer(input.electionVersion) || !election.sourcesCurrent || !election.approvedBy || election.withdrawnBy) throw new PayrollError('reviewed_current_retirement_election_required',409)
    const authority=this.reviewAuthority(actor,election)
    if (!await this.store.records.statement('SELECT 1 WHERE '+authority.sql,authority.args).first()) throw new PayrollError('retirement_review_authority_inactive',409)
    const payroll = input.payroll as unknown as PreviewInput
    let result:ReturnType<typeof retirementCalculationPreview>
    try { result=retirementCalculationPreview(payroll,election.data) }
    catch(error) { throw new PayrollError(error instanceof Error ? error.message : 'invalid_retirement_preview') }
    const sourceRef=text(input.sourceRef,1000)
    const id='retirement-'+await digest(JSON.stringify([personId,sourceRef]))
    const version=revision(input.version)
    const prior:Revision<Proposal>|undefined = version ? await this.store.find<Proposal>(actor,'retirement-preview',id,personId,true) : undefined
    if (prior && prior.version!==version) throw new PayrollError('retirement_preview_superseded',409)
    const data:Proposal={electionId:election.id,electionVersion:election.version,sourceRef,payroll,result,correctionReason:version?text(input.correctionReason,1000):'',
      correctsVersion:prior?.version??null,impact:prior?{
        employeeDifferenceCents:result.contribution.employeeCents-prior.data.result.contribution.employeeCents,
        employerMatchDifferenceCents:result.contribution.employerMatchCents-prior.data.result.contribution.employerMatchCents}:null}
    const saved=await this.store.append(actor,'retirement-preview',id,version,data,personId,true,{noPrivacyHold:personId,
      objects:[{kind:'retirement-election',id:election.id,version:election.version,approved:true}],
      condition:authority})
    return {...saved,data}
  }
}
