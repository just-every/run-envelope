import type { JsonSchemaObject, JsonSchema } from '../../modules/agent-door/index.ts'
const string={type:'string'},integer={type:'integer'},nullableString={type:['string','null']}
const object=(properties:Record<string,JsonSchema>,required=Object.keys(properties)):JsonSchemaObject=>({type:'object',properties,required})
const closed=(properties:Record<string,JsonSchema>,required=Object.keys(properties)):JsonSchemaObject=>({...object(properties,required),additionalProperties:false})
const literal=(value:string|boolean):JsonSchema=>({type:typeof value,const:value})
const count={type:'integer',minimum:0},day={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},sha256={type:'string',pattern:'^[a-f0-9]{64}$'}
const array=(items:JsonSchema):JsonSchema=>({type:'array',items})
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
const bonusItem=closed({id:string,version:integer,personId:string,amountCents:count,periodStart:day,periodEnd:day,payDate:day,
  sourcesCurrent:{type:'boolean'},status:literal('uncalculated-earnings-run')})
export function outputSchema(name:string):JsonSchemaObject {
  if(name==='records.list')return object({records:{type:'array',items:object({id:string,name:string,locationId:string,version:integer})},limit:integer,next:nullableString})
  if(name==='workspace.snapshot')return closed({people:count,drafts:count,bonuses:count,sha256})
  if(name==='draft.prepare')return object({id:string,status:string,approval:string,dispatch:string})
  if(name==='bonus.prepare')return object({id:string,version:integer,status:string,approval:string,dispatch:string})
  if(name==='draft.read')return object({id:string,personId:string,minutes:integer,hourlyCents:integer,status:string,approval:string,dispatch:string})
  if(name==='bonus.read')return closed({id:string,version:integer,preview:bonusPreview,sourcesCurrent:{type:'boolean'},
    status:literal('uncalculated-earnings-run'),approval:literal('requires-separate-human-proof'),dispatch:literal('unavailable')})
  if(name==='reports.bonuses')return closed({kind:literal('bonus-earnings-preparations'),bonuses:array(bonusItem),limit:integer,next:nullableString,
    payroll:literal('uncalculated'),payment:literal('unavailable'),filing:literal('unavailable')})
  if(name.startsWith('reports.'))return object({kind:string,[name==='reports.bonuses'?'bonuses':'proposals']:{type:'array',items:{type:'object'}},limit:integer,next:nullableString})
  if(name==='run.review')return object({runId:string,version:integer,reviewUrl:string,approval:string})
  if(name==='notice.process')return object({id:string,noticeId:string,summary:string,proposedReply:string,sourceReference:string,status:string,approval:string})
  if(name==='reply.dispatch')return object({id:string,version:integer,state:{type:'string',enum:['pending','accepted','rejected','unknown']},providerReceipt:nullableString})
  if(name==='credentials.rotate')return object({id:string,secretExpiresAt:integer,expiresAt:integer,algorithm:{type:'string',const:'RSA-OAEP-256'},encryptedToken:string})
  if(name==='credentials.restrict')return object({id:string,version:integer,direction:string,peopleCount:integer,actions:{type:'array',items:string},fields:{type:'array',items:string},locations:{type:'array',items:string}})
  throw new Error('Undeclared native output schema')
}
