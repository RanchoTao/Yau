/**
 * masteryau.com dedication service (Cloudflare Worker + KV).
 *
 * Visitors submit a short dedication; nothing is public until it is approved
 * in the admin page (/admin). Approved dedications appear as lit stars on the
 * site.
 *
 * KV layout (binding: DEDICATIONS)
 *   p:<id>   pending   { id, text, x, y, at, flags }
 *   a:<id>   approved  { id, text, x, y, at, approvedAt }
 *   rl:<h>   rate-limit marker (hashed IP, expires after RATE_WINDOW seconds)
 *
 * Secrets / vars
 *   ADMIN_TOKEN      password for the admin page (wrangler secret put ADMIN_TOKEN)
 *   ALLOWED_ORIGINS  comma-separated origins allowed to call the public API
 */
import { adminPage } from './admin.js'

const MAX_LEN = 40
const RATE_WINDOW = 60 // seconds between submissions from one visitor
const RATE_MAX = 3 // submissions allowed per window

// Anything matching is still queued for review, but marked so it stands out.
const FLAG_PATTERNS = [
  [/https?:\/\/|www\.|\.(com|cn|net|org|top|xyz)\b/i, '含链接'],
  [/[<>]|javascript:|on\w+\s*=/i, '含代码或标签'],
  [/\d{7,}|微信|vx|wx|qq|加我|联系方式/i, '疑似广告/联系方式'],
  [/傻[逼比b]|sb\b|操你|妈的|去死|垃圾|废物|滚|fuck|shit|bitch/i, '疑似辱骂'],
]

const json = (data, init = {}, headers = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

function cors(request, env) {
  const origin = request.headers.get('origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || 'https://masteryau.com').split(',').map((s) => s.trim())
  if (!allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison so the admin token can't be guessed by timing. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAdmin(request, env) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!env.ADMIN_TOKEN && safeEqual(token, env.ADMIN_TOKEN)
}

async function listValues(env, prefix) {
  const out = []
  let cursor
  do {
    const page = await env.DEDICATIONS.list({ prefix, cursor })
    const values = await Promise.all(page.keys.map((k) => env.DEDICATIONS.get(k.name, 'json')))
    out.push(...values.filter(Boolean))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}

function cleanText(raw) {
  return String(raw ?? '')
    // Strip control, zero-width and bidi-override characters (written as escapes to keep this file ASCII).
    .replace(new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e\\ufeff]', 'g'), '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN)
}

async function submit(request, env, headers) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式不正确' }, { status: 400 }, headers)
  }
  const text = cleanText(body.text)
  if (!text) return json({ error: '献辞不能为空' }, { status: 400 }, headers)

  // Light rate limit per visitor; only a hash of the IP is kept, and only briefly.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const rlKey = `rl:${(await sha256(ip + (env.ADMIN_TOKEN || ''))).slice(0, 24)}`
  const used = Number((await env.DEDICATIONS.get(rlKey)) || 0)
  if (used >= RATE_MAX) return json({ error: '提交太频繁，请稍后再试' }, { status: 429 }, headers)
  await env.DEDICATIONS.put(rlKey, String(used + 1), { expirationTtl: RATE_WINDOW })

  const x = Number(body.x), y = Number(body.y)
  const item = {
    id: crypto.randomUUID(),
    text,
    x: Number.isFinite(x) ? Math.min(0.94, Math.max(0.06, x)) : 0.08 + Math.random() * 0.84,
    y: Number.isFinite(y) ? Math.min(0.6, Math.max(0.06, y)) : 0.08 + Math.random() * 0.5,
    at: new Date().toISOString(),
    flags: FLAG_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label),
  }
  await env.DEDICATIONS.put(`p:${item.id}`, JSON.stringify(item))
  return json({ ok: true, status: 'pending' }, { status: 201 }, headers)
}

async function approved(env, headers) {
  const items = (await listValues(env, 'a:'))
    .sort((a, b) => (a.approvedAt < b.approvedAt ? 1 : -1))
    .map(({ id, text, x, y }) => ({ id, text, x, y }))
  return json({ items }, {}, { ...headers, 'cache-control': 'public, max-age=60' })
}

async function admin(request, env, path) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, { status: 401 })
  if (request.method === 'GET' && path === '/api/admin/list') {
    const [pending, live] = await Promise.all([listValues(env, 'p:'), listValues(env, 'a:')])
    pending.sort((a, b) => (a.at < b.at ? -1 : 1))
    live.sort((a, b) => (a.approvedAt < b.approvedAt ? 1 : -1))
    return json({ pending, approved: live })
  }
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 })
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad json' }, { status: 400 })
  }
  const id = String(body.id || '')
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'bad id' }, { status: 400 })

  if (path === '/api/admin/approve') {
    const item = await env.DEDICATIONS.get(`p:${id}`, 'json')
    if (!item) return json({ error: 'not found' }, { status: 404 })
    // Optional light edit before publishing (e.g. fix a typo).
    const text = body.text !== undefined ? cleanText(body.text) : item.text
    if (!text) return json({ error: 'empty text' }, { status: 400 })
    await env.DEDICATIONS.put(`a:${id}`, JSON.stringify({ id, text, x: item.x, y: item.y, at: item.at, approvedAt: new Date().toISOString() }))
    await env.DEDICATIONS.delete(`p:${id}`)
    return json({ ok: true })
  }
  if (path === '/api/admin/reject') {
    await env.DEDICATIONS.delete(`p:${id}`)
    return json({ ok: true })
  }
  if (path === '/api/admin/unpublish') {
    await env.DEDICATIONS.delete(`a:${id}`)
    return json({ ok: true })
  }
  return json({ error: 'not found' }, { status: 404 })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const headers = cors(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (path === '/api/dedications' && request.method === 'GET') return approved(env, headers)
    if (path === '/api/dedications' && request.method === 'POST') return submit(request, env, headers)
    if (path.startsWith('/api/admin/')) return admin(request, env, path)
    if (path === '/admin')
      return new Response(adminPage, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-robots-tag': 'noindex',
          'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
          'x-frame-options': 'DENY',
        },
      })
    return json({ error: 'not found' }, { status: 404 })
  },
}
