import assert from 'node:assert/strict';
import { request as httpsRequest } from 'node:https';
import { resolve } from 'node:path';
import { startRecordedWorker as unstable_startWorker, recordPrivateInput } from './privacy-recorder.mjs';

// A native TLS installation with only the paid mail transport replaced at its
// network edge. Sign-in proof and all payroll mutations remain real HTTP flows.
export async function withArchiveWorker(context, journey) {
  const origin = context.origin.replace('http:', 'https:'), port = Number(new URL(origin).port);
  const edge = { mails: [], noticeEffects: [] };
  const settings = { ...context.settings, AUTH_LOCAL: 'false', AUTH_ORIGIN: origin,
    MAIL_PROVIDER: 'resend', MAIL_FROM: 'Envelope <signin@example.com>', MAIL_API_KEY: 'synthetic-envelope-5300' };
  const start = async storage => {
    const instance = await unstable_startWorker({ config: resolve('dist/server/wrangler.json'),
      bindings: Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, { type: 'plain_text', value }])),
      dev: { server: { hostname: '127.0.0.1', port, secure: true }, origin: { hostname: new URL(origin).host, secure: true },
        inspector: false, remote: false, watch: false, persist: storage, logLevel: 'error', outboundService: async request => {
          if (request.url === 'https://api.resend.com/emails' && request.method === 'POST') {
            const payload = await request.json();
            edge.mails.push(payload);
            const id = '00000000-0000-4000-8000-' + String(5300 + edge.mails.length).padStart(12, '0');
            if (payload.subject.startsWith('Archive retained notice')) {
              edge.noticeEffects.push({ id, idempotencyKey: request.headers.get('Idempotency-Key'), subject: payload.subject });
              if (payload.subject.endsWith('unknown')) return new Response('Provider response unavailable', { status: 503 });
            }
            return Response.json({ id });
          }
          throw new Error('Unexpected archive outbound request');
        } },
    });
    await instance.ready; return instance;
  };
  const transport = { fetch: (url, init = {}) => new Promise((resolve, reject) => {
    assert.equal(new URL(url).origin, origin);
    const request = httpsRequest(url, { method: init.method, headers: init.headers, rejectUnauthorized: false }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('error', reject);
      response.on('end', () => {
        const headers = new Headers();
        for (let i = 0; i < response.rawHeaders.length; i += 2) headers.append(response.rawHeaders[i], response.rawHeaders[i + 1]);
        resolve(new Response([204, 304].includes(response.statusCode) ? null : Buffer.concat(chunks), { status: response.statusCode, headers }));
      });
    });
    recordPrivateInput(url, init.body); request.on('error', reject); request.end(init.body);
  }) };
  let instance = await start(context.persist);
  try {
    return await journey({ ...context, origin, settings, edge, worker: transport,
      cookie: '__Host-operator_session=' + context.cookie.slice(context.cookie.indexOf('=') + 1),
      quiesce: async action => {
        await instance.dispose();
        try { return await action(); } finally { instance = await start(context.persist); }
      },
      withRestoredWorker: async (storage, action) => {
        await instance.dispose();
        try { instance = await start(storage); return await action(); }
        finally { await instance.dispose(); instance = await start(context.persist); }
      },
    });
  } finally { await instance.dispose(); }
}
