import * as handlers from '../../lib/hash-handlers.mjs';
export default async request => {
 const event = {
  httpMethod: request.method,
  headers: { origin: request.headers.get('origin') },
  queryStringParameters: Object.fromEntries(new URL(request.url).searchParams),
  body: request.method === 'POST' ? await request.text() : ''
 };
 const result = await handlers.read(event);
 return new Response(result.body, { status: result.statusCode, headers: result.headers });
};
