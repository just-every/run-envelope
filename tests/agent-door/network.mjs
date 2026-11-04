/** Paid edges only. Native authority, encryption, preparation and dispatch run
 * in the real Worker. Validate the provider's documented request structure. */
export default {async fetch(request,{fixture}={}) {
  const url=new URL(request.url)
  if (request.method!=='POST' || !request.headers.get('authorization')?.startsWith('Bearer ') || !request.headers.get('content-type')?.startsWith('application/json')) return new Response(null,{status:400})
  const body=await request.json()
  if (url.origin==='https://api.openai.com' && url.pathname==='/v1/responses') {
    if (body.model!=='gpt-4.1-mini' || body.store!==false || body.text?.format?.type!=='json_schema' || body.input?.[0]?.role!=='user' || body.input[0].content?.[0]?.type!=='input_text') return new Response(null,{status:400})
    return Response.json({id:'resp_'+crypto.randomUUID(),object:'response',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({summary:'The notice requests an address confirmation.',proposedReply:'The address is unchanged.'})}]}]})
  }
  if (url.origin==='https://api.resend.com' && url.pathname==='/emails') {
    if (!body.from || !Array.isArray(body.to) || !body.to.length || !body.subject || !(body.text || body.html)) return new Response(null,{status:400})
    if(request.headers.get('Idempotency-Key')?.startsWith('envelope-notice-')) {
      if(body.to.length!==1 || !body.headers?.['X-RER-Attribution'] || !body.text?.includes('\nSent by '+body.headers['X-RER-Attribution']) || !body.text?.includes('\nHuman reviewer: '))return new Response(null,{status:422})
      if(fixture?.expected && JSON.stringify(body)!==JSON.stringify(fixture.expected))return new Response(null,{status:422})
      // The provider saw the request; the client receives no usable receipt.
      if(fixture?.lostResponse)return Response.json({})
    }
    return Response.json({id:crypto.randomUUID()})
  }
  return new Response(null,{status:502})
}}
