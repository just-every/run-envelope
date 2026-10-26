import { readFile } from 'node:fs/promises'
// Independent federal denominator. Removing an implementation never reduces it.
const required = 'AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'.split('|').map(v=>[v.slice(0,2),v.slice(3)])
const args=process.argv.slice(2)
if(args.length && (args[0]!=='--source' || args.length!==2)) throw Error('Usage: node ./scripts/compliance/new-hire-coverage.mjs [--source file.json]')
const source=JSON.parse(await readFile(args[1] ?? new URL('../../src/envelope/people/new-hire-directories.json',import.meta.url),'utf8'))
const missing=[],uncovered=[]
for(const [code,name] of required) {
 const entries=source.directories.filter(d=>d.code===code)
 if(entries.length!==1) {missing.push(name+' directory');continue}
 const entry=entries[0]
 if(!entry.implemented) uncovered.push(name)
 else for(const scenario of ['hire','rehire']) if(!entry.schemaCases?.includes(scenario)) missing.push(name+' '+scenario+' schema case')
}
console.log(JSON.stringify({complete:false,remainingFailures:source.remainingFailures,total:required.length,passing:required.length-missing.length-uncovered.length,missing,uncovered},null,2))
// Field mapping cannot certify the unexecuted authority transports.
process.exitCode=1
