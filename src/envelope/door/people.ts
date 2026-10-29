import { operatorAuthPeople, type Person } from '../../modules/agent-door/index.ts'
import { authConfig, operatorAuth, type Bindings } from '../../auth.server'
/** Payroll sponsorship requires current native company admission as well as
 * a live installation identity. An ordinary invited/team account grants none. */
export function payrollPeople(env: Bindings) {
  const people=operatorAuthPeople({db:env.DB,allowList:authConfig(env).allowList,session:request=>operatorAuth(env).getSession(request)})
  const paired=Boolean(env.RER_OWNER_CLAIM_PUBLIC_KEYS || env.RER_BUSINESS_TRUST)
  const roles=new Map<string,'owner'|'editor'|null>()
  const current=async(person:Person|null)=> {
    if(person) roles.set(person.id,paired ? (await people.businessMember?.(person))?.role??null : person.role==='owner'?'owner':person.role==='admin'?'editor':null)
    return person
  }
  return {...people,
    person:async(id:string)=>current(await people.person(id)),
    session:async(request:Request)=>current(await people.session(request)),
    businessRole:(person:Person)=>roles.get(person.id)??null,
    async sponsor(claims:{sub:string}) {
      const person=await current(await people.sponsor(claims))
      if(!person?.active)return null
      const admitted=await env.DB.prepare('SELECT 1 FROM env_grants WHERE operator_id=? AND revoked_at IS NULL LIMIT 1').bind(person.id).first()
      return admitted?person:null
    },
  }
}
