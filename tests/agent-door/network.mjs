/** Paid edges only. Native authority, encryption, preparation and dispatch run
 * in the real Worker. Validate the provider's documented request structure. */
export default {async fetch(request) {
  const url=new URL(request.url)
  if (request.method!=='POST' || !request.headers.get('authorization')?.startsWith('Bearer ') || !request.headers.get('content-type')?.startsWith('application/json')) return new Response(null,{status:400})
  const body=await request.json()
  if (url.origin==='https://api.openai.com' && url.pathname==='/v1/responses') {
    if (body.model!=='gpt-4.1-mini' || body.store!==false || body.text?.format?.type!=='json_schema' || body.input?.[0]?.role!=='user' || body.input[0].content?.[0]?.type!=='input_text') return new Response(null,{status:400})
    return Response.json({id:'resp_'+crypto.randomUUID(),object:'response',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({summary:'The notice requests an address confirmation.',proposedReply:'The address is unchanged.'})}]}]})
  }
  if (url.origin==='https://api.resend.com' && url.pathname==='/emails') {
    if (!body.from || !body.to || !body.subject || !(body.text || body.html)) return new Response(null,{status:400})
    return Response.json({id:crypto.randomUUID()})
  }
  return new Response(null,{status:502})
}}
