import { ToolRefusal } from '../../modules/agent-door/index.ts'
import type { AgentTools } from '../agents'
export async function rotationKey(value: unknown) {
  try {
    const jwk=value as {kty:string;n:string;e:string}
    if(jwk?.kty!=='RSA'||jwk.e!=='AQAB'||!/^[A-Za-z0-9_-]{342,1024}$/.test(jwk.n))throw new Error()
    return await crypto.subtle.importKey('jwk',{...jwk,alg:'RSA-OAEP-256',ext:true},{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt'])
  } catch {throw new ToolRefusal('invalid_rotation_key','invalid_rotation_key',{native_status:400})}
}
/** Base retains outcomes for replay. Only encrypted delivery may enter it;
 * the caller retains its private key and decrypts the native bearer locally. */
export async function rotate(agent: AgentTools, publicKey: unknown) {
  const key=await rotationKey(publicKey)
  await crypto.subtle.encrypt({name:'RSA-OAEP'},key,new TextEncoder().encode('delivery check'))
  const {token,...metadata}=await agent.rotate()
  const encrypted=await crypto.subtle.encrypt({name:'RSA-OAEP'},key,new TextEncoder().encode(token))
  return {...metadata,algorithm:'RSA-OAEP-256',encryptedToken:btoa(String.fromCharCode(...new Uint8Array(encrypted)))}
}
