import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'
// @ts-expect-error Base's JavaScript JWT verifier has no published declaration.
import { parseIdToken, verifyIdToken } from '../modules/operator-auth/identity/oidc/jwt.mjs'
import { fence, auditStatement, type Actor } from './access'
import { requirePayrollProof, stepUpFence } from './step-up'
import { presentationFence } from './review-presentation'
import { PayrollError } from './security'
import type { WorkspaceStore } from './workspace/store'
import { digest } from './workspace/store'

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const decode = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
/** Origin-bound UV is action-specific; ordinary sign-in freshness is insufficient. */
export class HumanProof {
  constructor(public store: WorkspaceStore) {}
  async registration(actor: Actor) {
    await this.store.authority(actor, 'pay:approve', undefined, true)
    await requirePayrollProof(this.store.records.env, actor)
    const options = await generateRegistrationOptions({rpName:'Envelope',
      rpID:new URL(this.store.records.env.AUTH_ORIGIN).hostname,
      userName:actor.session.operator.email,
      userID:new TextEncoder().encode(actor.session.operator.id),
      attestationType:'none', supportedAlgorithmIDs:[-7],
      authenticatorSelection:{residentKey:'required',userVerification:'required'},
    })
    const id = await this.save(actor, 'register', options.challenge)
    return {id, options}
  }
  async save(actor: Actor, purpose: string, challenge: string, reviewHash = '', runId = '', runVersion = 0, exact = '', presentationHash = '', client = 'native-envelope') {
    const f=fence(actor), id=crypto.randomUUID(), now=Date.now()
    const result=await this.store.records.statement(`INSERT INTO env_human_challenges
      (id,session_id,operator_id,operator_version,company_id,grant_version,origin,purpose,challenge,review_hash,run_id,run_version,content_digest,presenting_client,created_at,expires_at,presentation_hash)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql}`,
      [id,actor.session.id,actor.session.operator.id,actor.session.operator.version,actor.company,actor.grant.version,this.store.records.env.AUTH_ORIGIN,purpose,challenge,reviewHash,runId || null,runVersion || null,exact,client,now,now+300000,presentationHash,...f.args]).run()
    if (!result.meta.changes) throw new PayrollError('human_challenge_stale',409)
    return id
  }
  async challenge(actor: Actor, id: string, purpose: string) {
    const f=fence(actor)
    const row=await this.store.records.statement(`SELECT * FROM env_human_challenges WHERE id=? AND purpose=?
      AND session_id=? AND operator_id=? AND operator_version=? AND company_id=? AND grant_version=?
      AND origin=? AND consumed_at IS NULL AND expires_at>? AND ${f.sql}`,
      [id,purpose,actor.session.id,actor.session.operator.id,actor.session.operator.version,actor.company,actor.grant.version,this.store.records.env.AUTH_ORIGIN,Date.now(),...f.args]).first<Record<string, string | number>>()
    if (!row) throw new PayrollError('human_challenge_stale',409)
    return row
  }
  async register(actor: Actor, id: string, response: RegistrationResponseJSON) {
    await this.store.authority(actor,'pay:approve',undefined,true)
    await requirePayrollProof(this.store.records.env,actor)
    const row=await this.challenge(actor,id,'register'), env=this.store.records.env
    let verified
    try {
      const client=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(response.response.clientDataJSON.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))
      if(client.crossOrigin===true || client.topOrigin) throw 0
      verified=await verifyRegistrationResponse({response,expectedChallenge:String(row.challenge),expectedOrigin:env.AUTH_ORIGIN,
      expectedRPID:new URL(env.AUTH_ORIGIN).hostname,requireUserVerification:true,supportedAlgorithmIDs:[-7]}) }
    catch { throw new PayrollError('human_proof_invalid',403) }
    if (!verified.verified) throw new PayrollError('human_proof_invalid',403)
    const credential=verified.registrationInfo.credential, f=fence(actor), p=stepUpFence(actor), now=Date.now()
    const result=await env.DB.batch([
      this.store.records.statement(`INSERT INTO env_passkeys(credential_id,operator_id,operator_version,public_key,counter,created_at)
        SELECT ?,?,?,?,?,? WHERE ${f.sql} AND ${p.sql} AND EXISTS(SELECT 1 FROM env_human_challenges WHERE id=? AND consumed_at IS NULL AND expires_at>?)`,
        [credential.id,actor.session.operator.id,actor.session.operator.version,encode(credential.publicKey),credential.counter,now,...f.args,...p.args,id,now]),
      this.store.records.statement('UPDATE env_human_challenges SET consumed_at=? WHERE id=? AND EXISTS(SELECT 1 FROM env_passkeys WHERE credential_id=? AND created_at=?)',[now,id,credential.id,now]),
      auditStatement(env,actor,crypto.randomUUID(),'identity.passkey-registered',actor.session.operator.id,actor.session.operator.version,'EXISTS(SELECT 1 FROM env_passkeys WHERE credential_id=? AND created_at=?)',[credential.id,now]),
    ])
    if (!result[0].meta.changes) throw new PayrollError('human_challenge_stale',409)
    return {registered:true}
  }
  async options(actor: Actor, reviewToken: string, runId: string, version: number, exact: string, presentationHash = '', client = 'native-envelope') {
    const credentials=(await this.store.records.statement('SELECT credential_id FROM env_passkeys WHERE operator_id=? AND operator_version=?',
      [actor.session.operator.id,actor.session.operator.version]).all<{credential_id:string}>()).results
    const options=await generateAuthenticationOptions({rpID:new URL(this.store.records.env.AUTH_ORIGIN).hostname,
      userVerification:'required',allowCredentials:credentials.map(c=>({id:c.credential_id}))})
    const id=await this.save(actor,'approve',options.challenge,await digest(reviewToken),runId,version,exact,presentationHash,client)
    return {id, options, enrolled:credentials.length>0}
  }
  async oidc(actor: Actor, row: Record<string,string|number>, token: string) {
    const pin=await this.store.records.statement(`SELECT p.* FROM oa_identity_providers p
      WHERE p.provider_id='auth' AND p.preset='auth' AND p.status='linked' AND p.pending_at IS NULL
      AND EXISTS(SELECT 1 FROM oa_auth_settings WHERE singleton=1 AND idp_sign_in=1)
      AND EXISTS(SELECT 1 FROM rer_dependency_link l WHERE l.interface='oidc-provider@1' AND l.needs_relink=0 AND l.issuer=p.issuer AND l.client_id=p.client_id)`,[]).first<Record<string,string|number>>()
    if(!pin) throw new PayrollError('human_mfa_unavailable',403)
    try {
      const link={issuer:pin.issuer,clientId:pin.client_id,algorithms:JSON.parse(String(pin.algorithms))}
      const parsed=parseIdToken(token,link)
      const claims=await verifyIdToken(parsed,JSON.parse(String(pin.jwks)),link,{additionalAudiences:[]},
        {clockSkewSeconds:0,maxTokenAgeSeconds:300},{nonce:row.challenge},{},Date.now())
      if (!Array.isArray(claims.amr) || !claims.amr.includes('mfa') || claims.amr.includes('dev') ||
        !Number.isSafeInteger(claims.auth_time) || claims.auth_time<Math.floor(Number(row.created_at)/1000) || claims.auth_time>Date.now()/1000) throw 0
      const identity=await this.store.records.statement('SELECT 1 AS same FROM oa_external_identities WHERE issuer=? AND subject=? AND operator_id=?',
        [claims.iss,claims.sub,actor.session.operator.id]).first()
      if(!identity) throw 0
      return {id:String(row.id),method:'oidc-mfa',sql:`EXISTS(SELECT 1 FROM oa_identity_providers p WHERE p.provider_id='auth' AND p.status='linked' AND p.pending_at IS NULL AND p.issuer=? AND p.client_id=? AND p.linked_at=? AND p.jwks=? AND EXISTS(SELECT 1 FROM oa_external_identities WHERE issuer=p.issuer AND subject=? AND operator_id=?) AND EXISTS(SELECT 1 FROM oa_auth_settings WHERE singleton=1 AND idp_sign_in=1) AND EXISTS(SELECT 1 FROM rer_dependency_link l WHERE l.interface='oidc-provider@1' AND l.needs_relink=0 AND l.issuer=p.issuer AND l.client_id=p.client_id))`,
        args:[pin.issuer,pin.client_id,pin.linked_at,pin.jwks,claims.sub,actor.session.operator.id]}
    } catch {throw new PayrollError('human_proof_invalid',403)}
  }
  async verify(actor: Actor, id: string, response: AuthenticationResponseJSON | {idToken:string}, hash: string, runId: string, version: number, exact: string) {
    const row=await this.challenge(actor,id,'approve')
    if (row.review_hash!==hash || row.run_id!==runId || row.run_version!==version || row.content_digest!==exact)
      throw new PayrollError('human_challenge_stale',409)
    if(!response || typeof response!=='object' || Array.isArray(response)) throw new PayrollError('human_proof_invalid',403)
    if ('idToken' in response) return this.oidc(actor,row,response.idToken)
    const credential=await this.store.records.statement('SELECT * FROM env_passkeys WHERE credential_id=? AND operator_id=? AND operator_version=?',
      [response?.id ?? '',actor.session.operator.id,actor.session.operator.version]).first<{credential_id:string;public_key:string;counter:number}>()
    if (!credential) throw new PayrollError('human_proof_invalid',403)
    try {
      const client=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(response.response.clientDataJSON.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))
      if(client.crossOrigin===true || client.topOrigin) throw 0
      const result=await verifyAuthenticationResponse({response,expectedChallenge:String(row.challenge),expectedOrigin:this.store.records.env.AUTH_ORIGIN,
        expectedRPID:new URL(this.store.records.env.AUTH_ORIGIN).hostname,requireUserVerification:true,
        credential:{id:credential.credential_id,publicKey:decode(credential.public_key),counter:credential.counter}})
      if (!result.verified) throw 0
      return {id, method:'passkey-uv', credentialId:credential.credential_id, counter:credential.counter, nextCounter:result.authenticationInfo.newCounter,
        sql:'EXISTS(SELECT 1 FROM env_passkeys WHERE credential_id=? AND operator_id=? AND operator_version=? AND counter=?)',
        args:[credential.credential_id,actor.session.operator.id,actor.session.operator.version,credential.counter]}
    } catch { throw new PayrollError('human_proof_invalid',403) }
  }
}
