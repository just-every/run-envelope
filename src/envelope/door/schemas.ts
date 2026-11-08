import type { JsonSchemaObject, JsonSchema } from '../../modules/agent-door/index.ts'
const string={type:'string'},integer={type:'integer'},nullableString={type:['string','null']}
const object=(properties:Record<string,JsonSchema>,required=Object.keys(properties)):JsonSchemaObject=>({type:'object',properties,required})
const closed=(properties:Record<string,JsonSchema>,required=Object.keys(properties)):JsonSchemaObject=>({...object(properties,required),additionalProperties:false})
const literal=(value:string|boolean):JsonSchema=>({type:typeof value,const:value})
const count={type:'integer',minimum:0},day={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},sha256={type:'string',pattern:'^[a-f0-9]{64}$'}
const array=(items:JsonSchema):JsonSchema=>({type:'array',items})
const immutableVersion={type:'integer',const:1}
// This is the native bonus preparation, with calculation and release still held.
const bonusPreview=closed({
  periodStart:day,periodEnd:day,payDate:day,frequency:literal('off-cycle bonus'),groupId:literal(''),
  people:array(closed({id:string,name:string,earningsCents:count,taxableCashCents:count,reimbursementCents:count,afterTaxDeductionCents:count,
    cashTipsCents:count,paycheckTipsCents:count,tipFundsCents:count,details:array(string)})),
  holds:array(closed({personId:string,code:literal('bonus-calculation-incomplete'),reason:string})),
  destinations:array(closed({personId:string,bankVersion:count})),
  grossCashCents:count,taxableCashCents:count,reimbursementCents:count,afterTaxDeductionCents:count,
  taxAmounts:{type:'null',description:'Tax has not been calculated.'},netPay:{type:'null',description:'Net pay has not been calculated.'},paymentReady:literal(false),
  setupFingerprint:string,locationStates:array(string),ruleFingerprint:string,
  ruleSources:array(closed({id:string,version:integer,name:string,determination:string,approved:{type:'boolean'},state:string,family:string,
    details:{type:'object',additionalProperties:string}},['id','version','name','determination','approved'])),
  bonusPreparation:closed({credentialId:string,requestFingerprint:sha256,sourceRef:string,amountCents:count}),
})
const bonusItem=closed({id:string,version:immutableVersion,personId:string,amountCents:count,periodStart:day,periodEnd:day,payDate:day,
  sourcesCurrent:{type:'boolean'},status:literal('uncalculated-earnings-run')})
const proposalState={status:literal('uncalculated-proposal'),approval:literal('not-approved'),dispatch:literal('unavailable')}
const proposalItem={id:string,personId:string,personVersion:integer,rateId:string,minutes:integer,
  periodStart:day,periodEnd:day,payDate:day,stale:{type:'integer',enum:[0,1]}}
export function outputSchema(name:string):JsonSchemaObject {
  if(name==='records.list')return closed({records:array(closed({id:string,name:string,locationId:string,version:integer})),limit:integer,next:nullableString})
  if(name==='workspace.snapshot')return closed({people:count,drafts:count,bonuses:count,sha256})
  if(name==='draft.prepare')return closed({id:string,...proposalState})
  if(name==='bonus.prepare')return closed({id:string,version:immutableVersion,status:literal('uncalculated-earnings-run'),approval:literal('requires-separate-human-proof'),dispatch:literal('unavailable')})
  if(name==='draft.read')return closed({...proposalItem,personName:string,hourlyCents:integer,sourceRef:string,...proposalState})
  if(name==='bonus.read')return closed({id:string,version:immutableVersion,preview:bonusPreview,sourcesCurrent:{type:'boolean'},
    status:literal('uncalculated-earnings-run'),approval:literal('requires-separate-human-proof'),dispatch:literal('unavailable')})
  if(name==='reports.bonuses')return closed({kind:literal('bonus-earnings-preparations'),bonuses:array(bonusItem),limit:integer,next:nullableString,
    payroll:literal('uncalculated'),payment:literal('unavailable'),filing:literal('unavailable')})
  if(name==='reports.proposals')return closed({kind:literal('run-input-proposals'),proposals:array(closed(proposalItem)),limit:integer,next:nullableString,
    payroll:literal('uncalculated'),payment:literal('unavailable'),filing:literal('unavailable')})
  if(name==='run.review')return closed({runId:string,version:integer,reviewUrl:{type:'string',format:'uri'},approval:literal('requires-separate-human-proof')})
  if(name==='notice.process')return closed({id:string,noticeId:string,summary:string,proposedReply:string,sourceReference:string,status:literal('untrusted-proposal'),approval:literal('not-approved')})
  if(name==='reply.dispatch') {
    const dispatch={id:string,version:integer,jobId:string,state:{type:'string',enum:['pending','accepted','rejected','unknown']},providerReceipt:nullableString}
    // A native duplicate returns its retained state without asserting delivery.
    return {type:'object',oneOf:[closed({...dispatch,delivered:literal('unconfirmed')}),closed({...dispatch,replayed:literal(true)})],
      allOf:[{oneOf:[
        object({state:literal('accepted'),providerReceipt:{type:'string',format:'uuid'}}),
        object({state:{type:'string',enum:['pending','rejected','unknown']},providerReceipt:{type:'null'}}),
      ]}]}
  }
  if(name==='credentials.rotate')return closed({id:string,secretExpiresAt:integer,expiresAt:integer,algorithm:literal('RSA-OAEP-256'),encryptedToken:{type:'string',pattern:'^[A-Za-z0-9+/]+={0,2}$'}})
  if(name==='credentials.restrict')return closed({id:string,version:integer,direction:{type:'string',enum:['narrow','unchanged']},peopleCount:integer,actions:array(string),fields:array(string),locations:array(string)})
  if(name==='job.status')return closed({jobId:string,id:string,version:integer,state:{type:'string',enum:['pending','accepted','rejected','unknown']},providerReceipt:nullableString,delivered:literal('unconfirmed')})
  throw new Error('Undeclared native output schema')
}
