// Drive the native WebAuthn API with a browser-owned virtual authenticator.
export const credentialResponse=async(page,options,register=false)=>page.evaluate(async({options,register})=>{
      const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
      const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
      options.challenge=decode(options.challenge)
      if(register) options.user.id=decode(options.user.id)
      for(const key of ['allowCredentials','excludeCredentials']) for(const c of options[key]??[]) c.id=decode(c.id)
      const c=await navigator.credentials[register?'create':'get']({publicKey:options})
      return {id:c.id,rawId:encode(c.rawId),type:c.type,clientExtensionResults:c.getClientExtensionResults(),response:Object.fromEntries(
        ['clientDataJSON','attestationObject','authenticatorData','signature','userHandle'].filter(k=>c.response[k]).map(k=>[k,encode(c.response[k])]))}
    },{options,register})
