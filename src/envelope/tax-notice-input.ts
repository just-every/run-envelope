import type { Input } from './records'
import { PayrollError } from './security'

export async function taxNoticeMultipart(request:Request):Promise<Input> {
  const reader=request.body?.getReader()
  if(!reader) throw new PayrollError('invalid_notice_input')
  const chunks:Uint8Array[]=[],limit=640000
  let size=0
  while(true) {
    const next=await reader.read()
    if(next.done) break
    size+=next.value.length
    if(size>limit) {await reader.cancel();throw new PayrollError('input_too_large',413)}
    chunks.push(next.value)
  }
  const bytes=new Uint8Array(size)
  let offset=0
  for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length}
  let form:FormData
  try {form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData()}
  catch {throw new PayrollError('invalid_notice_input')}
  const input:Input={}
  for(const [name,value] of form) {
    if(Object.hasOwn(input,name) || ['__proto__','constructor','prototype'].includes(name)) throw new PayrollError('duplicate_input')
    if(typeof value==='string') {
      if(name==='pdf') throw new PayrollError('notice_pdf_required')
      input[name]=value
    } else {
      if(name!=='pdf' || !value.size || value.size>384000) throw new PayrollError('notice_pdf_required')
      const data=new Uint8Array(await value.arrayBuffer())
      let binary=''
      for(let i=0;i<data.length;i+=8192) binary+=String.fromCharCode(...data.subarray(i,i+8192))
      input.pdf=btoa(binary)
    }
  }
  return input
}
