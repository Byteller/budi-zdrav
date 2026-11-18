import { getStore } from '@netlify/blobs';

// POST /api/photo  (body: image/png|jpeg)  -> { path: "/api/photo/<id>" }
// GET  /api/photo/<id>                     -> the stored image
export const config = { path: ['/api/photo', '/api/photo/*'] };

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg' };

export default async (req) => {
  const store = getStore('signature-images');
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

  if (req.method === 'POST') {
    const type = (req.headers.get('content-type') || '').split(';')[0].trim();
    if (!TYPES[type]) return json({ error: 'unsupported type' }, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return json({ error: 'bad size' }, 413);
    const id = `${crypto.randomUUID()}.${TYPES[type]}`;
    await store.set(id, buf, { metadata: { type } });
    return json({ path: `/api/photo/${id}` });
  }

  if (req.method === 'GET') {
    const id = new URL(req.url).pathname.split('/').pop();
    if (!/^[0-9a-f-]{36}\.(png|jpg)$/.test(id)) return new Response('Not found', { status: 404 });
    const entry = await store.getWithMetadata(id, { type: 'arrayBuffer' });
    if (!entry) return new Response('Not found', { status: 404 });
    return new Response(entry.data, {
      headers: {
        'content-type': entry.metadata?.type || 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
