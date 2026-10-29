import {randomBytes} from 'node:crypto'
export default async function(){return randomBytes(32).toString('base64')}
