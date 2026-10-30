import type { JsonSchemaObject, JsonSchema } from '../../modules/agent-door/index.ts'
const string={type:'string'},integer={type:'integer'},nullableString={type:['string','null']}
const object=(properties:Record<string,JsonSchema>,required=Object.keys(properties)):JsonSchemaObject=>({type:'object',properties,required})
export function outputSchema(name:string):JsonSchemaObject {
  if(name==='records.list')return object({records:{type:'array',items:object({id:string,name:string,locationId:string,version:integer})},limit:integer,next:nullableString})
  if(name==='workspace.snapshot')return object({people:integer,drafts:integer,bonuses:integer,sha256:string})
  if(name==='draft.prepare')return object({id:string,status:string,approval:string,dispatch:string})
  if(name==='bonus.prepare')return object({id:string,version:integer,status:string,approval:string,dispatch:string})
  if(name==='draft.read')return object({id:string,personId:string,minutes:integer,hourlyCents:integer,status:string,approval:string,dispatch:string})
  if(name==='bonus.read')return object({id:string,version:integer,preview:{type:'object'},status:string})
  if(name.startsWith('reports.'))return object({kind:string,[name==='reports.bonuses'?'bonuses':'proposals']:{type:'array',items:{type:'object'}},limit:integer,next:nullableString})
  if(name==='run.review')return object({runId:string,version:integer,reviewUrl:string,approval:string})
  if(name==='notice.process')return object({id:string,noticeId:string,summary:string,proposedReply:string,sourceReference:string,status:string,approval:string})
  if(name==='reply.dispatch')return object({id:string,version:integer,state:{type:'string',enum:['pending','accepted','rejected','unknown']},providerReceipt:nullableString})
  if(name==='credentials.rotate')return object({id:string,secretExpiresAt:integer,expiresAt:integer,algorithm:{type:'string',const:'RSA-OAEP-256'},encryptedToken:string})
  if(name==='credentials.restrict')return object({id:string,version:integer,direction:string,peopleCount:integer,actions:{type:'array',items:string},fields:{type:'array',items:string},locations:{type:'array',items:string}})
  throw new Error('Undeclared native output schema')
}
