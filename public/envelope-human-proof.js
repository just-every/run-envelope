// The browser asks its authenticator only after the person presses a labeled control.
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const serialize = credential => ({id:credential.id,rawId:encode(credential.rawId),type:credential.type,
  clientExtensionResults:credential.getClientExtensionResults(),response:Object.fromEntries(
    ['clientDataJSON','attestationObject','authenticatorData','signature','userHandle'].filter(k=>credential.response[k]).map(k=>[k,encode(credential.response[k])]))})
const post = async (url, body) => {
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  const result=await response.json()
  if(!response.ok) throw Error(result.error)
  return result
}
const form=document.querySelector('[data-human-approval]'), message=document.querySelector('[data-human-message]')
const notices={human_challenge_stale:'This identity review expired. Open a fresh review; nothing was approved.',
  review_stale:'This review changed. Open a fresh review; nothing was approved.',
  human_proof_invalid:'Identity verification failed. Nothing was approved.',
  presenting_client_revoked:'The presenting client is no longer authorized. Open a new review in Envelope.',
  step_up_required:'Confirm your identity with a fresh email verification before registering a passkey.'}
const report=error=>{message.textContent=error.name==='NotAllowedError'?'Identity verification was canceled. Nothing was approved.':notices[error.message]??'Verification could not finish. Nothing was approved. Try a fresh review.'; message.focus()}
if(form) {
  const base=form.dataset.base
  document.querySelector('[data-enroll-passkey]').addEventListener('click',async event=>{
    event.currentTarget.disabled=true
    try {
      const {id,options}=await post(base+'/passkeys/options',{})
      options.challenge=decode(options.challenge);options.user.id=decode(options.user.id)
      for(const c of options.excludeCredentials??[]) c.id=decode(c.id)
      const credential=await navigator.credentials.create({publicKey:options})
      await post(base+'/passkeys/register',{id,response:serialize(credential)})
      location.reload()
    } catch(error) {report(error);event.currentTarget.disabled=false}
  })
  form.addEventListener('submit',async event=>{
    event.preventDefault()
    const button=form.querySelector('[type=submit]');button.disabled=true
    try {
      const options=JSON.parse(form.dataset.options)
      options.challenge=decode(options.challenge)
      for(const c of options.allowCredentials??[]) c.id=decode(c.id)
      const credential=await navigator.credentials.get({publicKey:options})
      await post(form.action,{version:Number(form.elements.version.value),reviewToken:form.elements.reviewToken.value,
        humanChallenge:form.dataset.challenge,gesture:'approve-exact-run',assertion:serialize(credential)})
      location.href=base.replace('/api/','/app/')
    } catch(error) {report(error);button.disabled=false}
  })
}
