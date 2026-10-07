/* ───────────────────────────────────────────────────────────
   بک‌اند «یه قرار کوچیک»
   سرو کردن سایت + دریافت نتیجه و ارسال به تلگرام با Bot API
   بدون هیچ پکیج خارجی — فقط Node
   ─────────────────────────────────────────────────────────── */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT     = fileURLToPath(new URL('.', import.meta.url))
const TOKEN    = process.env.TELEGRAM_BOT_TOKEN || ''
const PORT     = Number(process.env.PORT || 3000)
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '')
const BOT_NAME = process.env.BOT_NAME || ''
const OWNER_CHAT = process.env.OWNER_CHAT_ID || ''   // نتیجه همیشه به این چت می‌رود
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || '').replace(/\/+$/, '')

/* اسامی بن‌شده — با کاما جدا، مثلاً: BLOCKED_NAMES=غزل,زهرا
   چک هم روی نام و هم روی یوزرنیم انجام می‌شود (بدون @).
   کوتیشن و فاصلهٔ اضافه هم پاک می‌شوند، چون در پنل Render آسان است
   که همراه مقدار تایپ شوند و آن‌وقت نام هرگز تطبیق نمی‌خورد. */
const BLOCKED_NAMES = (process.env.BLOCKED_NAMES || '')
  .split(',').map(s => norm(s.replace(/^["']|["']$/g, ''))).filter(Boolean)

const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : ''
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/* یکسان‌سازی اسم فارسی تا «غزل»، «غَزل»، «غـزل» و «ي غزل» یکی دیده شوند:
   ی/ک عربی، نیم‌فاصله، اعراب و کشیده حذف می‌شوند و فاصله‌ها جمع. */
function norm(s){
  return String(s ?? '')
    .replace(/[ً-ْٰ‌‏‎ـ]/g, '')   // اعراب، نیم‌فاصله، کشیده، جهت‌دهی
    .replace(/[يى]/g, 'ی')            // ی/ى عربی → ی
    .replace(/ك/g, 'ک')                     // ك عربی → ک
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ی')
    .replace(/[ۀة]/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
function isBlocked(s){ return BLOCKED_NAMES.includes(norm(s)) }

/* ── نشست‌ها: کلید deep-link → chat_id ──────────────────────
   هر کاربری که /start را می‌زند یک کلید یکتا می‌گیرد؛ نتیجهٔ فرم
   با همان کلید برمی‌گردد و فقط به همان گفتگو فرستاده می‌شود.        */
const sessions = new Map()
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30          // ۳۰ روز

function newKey(){
  const a = new Uint8Array(9)
  crypto.getRandomValues(a)
  return Buffer.from(a).toString('base64url')
}
function putSession(key, chatId, who = {}){
  sessions.set(key, { chatId, who, ts: Date.now() })
  if (sessions.size > 5000){
    for (const [k, v] of sessions) if (Date.now() - v.ts > SESSION_TTL) sessions.delete(k)
  }
}
function getSession(key){
  const s = sessions.get(key)
  if (!s) return null
  if (Date.now() - s.ts > SESSION_TTL){ sessions.delete(key); return null }
  return s
}
function takeChat(key){ return getSession(key)?.chatId ?? null }

/* ── محدودسازی نرخ: جلوگیری از اسپم شدن ربات ─────────────── */
const hits = new Map()
function rateLimited(ip){
  const now = Date.now()
  const rec = hits.get(ip) || { n: 0, t: now }
  if (now - rec.t > 60_000){ rec.n = 0; rec.t = now }
  rec.n++
  hits.set(ip, rec)
  if (hits.size > 2000) hits.clear()
  return rec.n > 12                            // ۱۲ ارسال در دقیقه
}

/* ── Telegram ─────────────────────────────────────────────── */
async function tg(method, body){
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) console.error('telegram error:', method, j.description || r.status)
  return j
}

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

/* لینک دعوت باید همیشه به جایی برود که /api/result دارد. اگر SITE_URL
   اشتباه تنظیم شده باشد (مثلاً Pages که سرور ندارد)، دامنهٔ خودِ این سرور
   استفاده می‌شود تا دکمه بی‌صدا شکست نخورد. */
let selfOrigin = ''

/* پیام رد برای کسانی که بن شده‌اند — عمداً بدون جزئیات، تا معلوم نشود
   چه کسی لیست است */
const BLOCKED_MSG = 'دسترسی شما به این دعوت‌نامه فعال نیست.'
function inviteLink(key){
  const base = (SITE_URL && !/github\.io/i.test(SITE_URL)) ? SITE_URL : selfOrigin
  const url = base ? `${base}/?k=${key}` : '—'
  return [
    'یه قرار کوچیک با هم؟ ❤️',
    '',
    'چندتا سؤال دارم، جواب بده تا ببینیم آخرش کجا می‌رسیم...',
    '',
    url,
    '',
    'بعد از پر کردن، نتیجه همین‌جا برات میاد.'
  ].join('\n')
}

/* ── حلقهٔ long-polling ───────────────────────────────────── */
let stopping = false
async function poll(){
  if (!TOKEN) return
  let offset = 0
  console.log('telegram: polling started')
  while (!stopping){
    try{
      const r = await fetch(`${API}/getUpdates?timeout=25&offset=${offset}`)
      const j = await r.json()
      if (!j.ok){
        await sleep(5000)
        continue
      }
      for (const u of j.result){
        offset = u.update_id + 1
        const msg = u.message || u.edited_message
        const text = msg?.text || ''
        if (msg?.chat?.type === 'private' && text.startsWith('/start')){
          const who = {
            name:  [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ').trim(),
            user:  msg.from?.username || '',
            id:    msg.from?.id ?? null
          }
          /* کاربر بن‌شده لینک دعوت نمی‌گیرد؛ فقط پیام رد شدن. */
          if (isBlocked(who.name) || isBlocked(who.user)){
            await tg('sendMessage', { chat_id: msg.chat.id, text: BLOCKED_MSG })
            continue
          }
          const key = text.split(/\s+/)[1] || newKey()
          putSession(key, msg.chat.id, who)
          await tg('sendMessage', { chat_id: msg.chat.id, text: inviteLink(key) })
        }
      }
    }catch(e){
      console.error('poll:', e.message)
      await sleep(5000)
    }
  }
}

/* ── ساخت متن نتیجه ───────────────────────────────────────── */
function buildMessage(d, who){
  const rows = [
    ['📍 کجا؟',            d.place   ? [d.place, d.address, d.region].filter(Boolean).join('\n') : null],
    ['🕐 چه ساعتی؟',       d.time    ? `${d.time}${d.period ? '\n' + d.period : ''}` : null],
    ['🍕 چی بخوریم؟',      d.foods?.length ? d.foods.join('، ') : null],
    ['👥 با کیا؟',         d.guests  || null]
  ].filter(([, v]) => v)

  const from = who?.name
    ? `از ${esc(who.name)}${who.user ? ' (@' + esc(who.user) + ')' : ''}`
    : null

  return [
    '💌 پس قرارمون مشخص شد!',
    from || '',
    '',
    ...rows.flatMap(([k, v]) => [`<b>${k}</b>`, esc(v), '']),
    'پس میبینمت ❤️'
  ].filter(l => l !== '').join('\n')
}

/* فیلدهای «فهرست اسامی» (همراهان) باید تکه‌تکه سنجیده شوند تا «علی، غزل»
   گرفته شود؛ بقیه با تطابق کامل تا «کافه غزل» بن نشود. */
function bannedIn(d){
  const foods = Array.isArray(d.foods) ? d.foods : []
  const parts = [String(d.guests || '')].flatMap(s => s.split(/[,،؛;·\s]+/))
  const whole = [d.place, d.address, d.region, ...foods].filter(v => typeof v === 'string')
  return BLOCKED_NAMES.some(b => [...parts, ...whole].some(p => norm(p) === norm(b)))
}

/* ── سرور HTTP ────────────────────────────────────────────── */
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon'
}

function json(res, code, body){
  res.writeHead(code, { 'content-type':'application/json; charset=utf-8', ...cors() })
  res.end(JSON.stringify(body))
}
const cors = () => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, GET, OPTIONS'
})

const server = createServer(async (req, res) => {
  /* دامنهٔ واقعی سرور را یک‌بار نگه می‌داریم تا لینک دعوت خودکار درست شود */
  if (!selfOrigin && req.headers.host && !/^(localhost|127\.0\.0\.1)/.test(req.headers.host)){
    selfOrigin = `https://${req.headers.host}`
  }
  const url  = new URL(req.url, 'http://x')
  const path = url.pathname

  if (req.method === 'OPTIONS'){ res.writeHead(204, cors()); return res.end() }

  /* سلامت — blocked فقط تعداد بن‌ها را می‌گوید، نه اسمشان را */
  if (path === '/api/health'){
    return json(res, 200, {
      ok: true, telegram: !!TOKEN, sessions: sessions.size,
      blocked: BLOCKED_NAMES.length
    })
  }

  /* دریافت نتیجه */
  if (path === '/api/result' && req.method === 'POST'){
    if (!TOKEN) return json(res, 503, { ok:false, error:'ربات پیکربندی نشده' })
    const ip = req.socket.remoteAddress || 'unknown'
    if (rateLimited(ip)) return json(res, 429, { ok:false, error:'کمی آرام‌تر!' })

    let d
    try{
      const raw = await readBody(req, 8_000)
      d = JSON.parse(raw)
    }catch{ return json(res, 400, { ok:false, error:'داده نامعتبر' }) }

    const s     = getSession(String(d.key || ''))
    const chatId = OWNER_CHAT || s?.chatId
    if (!chatId) return json(res, 404, { ok:false, error:'نشست منقضی شده — دوباره از ربات لینک بگیر' })

    /* بلاک را سمت سرور می‌گیریم تا با تغییر مرورگر یا رفرش دور زده نشود.
       هم روی هویت فرستنده در ربات، هم روی متن خودِ فرم (اسم همراهان و…). */
    if (isBlocked(s?.who?.name) || isBlocked(s?.who?.user)){
      return json(res, 403, { ok:false, banned:true, error:'دسترسی شما به این دعوت‌نامه فعال نیست.' })
    }
    if (bannedIn(d)){
      return json(res, 403, { ok:false, banned:true, error:'دسترسی شما به این دعوت‌نامه فعال نیست.' })
    }

    const foods = Array.isArray(d.foods) ? d.foods.filter(f => typeof f === 'string').slice(0, 8) : []
    const sent  = await tg('sendMessage', {
      chat_id: chatId,
      text: buildMessage({ ...d, foods }, s?.who),
      parse_mode: 'HTML'
    })
    return json(res, sent.ok ? 200 : 502, { ok: !!sent.ok, error: sent.description })
  }

  /* فایل‌های ثابت — فقط index.html و پوشه‌های عمومی، نه کل پوشه پروژه
     (وگرنه server.js و فایل‌های تنظیمات هم سرو می‌شوند) */
  let rel = decodeURIComponent(path === '/' ? '/index.html' : path)
  rel = normalize(rel).replace(/^(\.\.[/\\])+/, '')
  const PUBLIC = ['/index.html', '/css', '/js', '/assets']
  if (!PUBLIC.some(p => rel === p || rel.startsWith(p + '/'))) {
    return serveIndex(res, req.headers.host)
  }

  const file = join(ROOT, rel)
  if (!file.startsWith(ROOT)){ res.writeHead(403); return res.end('forbidden') }

  try{
    let buf = await readFile(file)
    const isHtml = rel === '/index.html'
    /* آدرس API را داخل HTML تزریق کن تا فرم بداند بک‌اند کجاست */
    if (isHtml) buf = injectApi(buf, req.headers.host)
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': isHtml ? 'no-cache' : 'public, max-age=300'
    })
    res.end(buf)
  }catch{
    serveIndex(res, req.headers.host)
  }
})

/* data-api روی <body> را با آدرس واقعی سرور جایگزین می‌کند تا فرم بداند
   بک‌اند کجاست؛ برای سایتی که روی GitHub Pages سرو می‌شود لازم است. */
function injectApi(buf, host){
  const origin = PUBLIC_ORIGIN || `https://${host}`
  return Buffer.from(
    buf.toString('utf8').replace('data-api="/"', `data-api="${origin}"`)
  )
}

/* مسیرهای نشناخته به صفحهٔ اصلی می‌رسند (SPA) */
function serveIndex(res, host){
  readFile(join(ROOT, 'index.html')).then(
    raw => {
      const buf = injectApi(raw, host)
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control':'no-cache' })
      res.end(buf)
    },
    () => { res.writeHead(404); res.end('not found') }
  )
}

function readBody(req, limit){
  return new Promise((ok, no) => {
    let n = 0, buf = ''
    req.on('data', c => {
      n += c.length
      if (n > limit){ no(new Error('too large')); req.destroy() }
      else buf += c
    })
    req.on('end', () => ok(buf))
    req.on('error', no)
  })
}

server.listen(PORT, () => {
  console.log(`listening on :${PORT}`)
  if (!TOKEN)       console.warn('⚠ TELEGRAM_BOT_TOKEN تنظیم نشده — ارسال پیام کار نمی‌کند')
  if (!SITE_URL)    console.warn('⚠ SITE_URL تنظیم نشده — لینک داخل ربات خالی می‌ماند')
  if (!BOT_NAME)    console.warn('⚠ BOT_NAME تنظیم نشده')
  if (!BLOCKED_NAMES.length) console.warn('⚠ BLOCKED_NAMES تنظیم نشده — لیست بن خالی است')
  poll()
})

for (const sig of ['SIGINT', 'SIGTERM']){
  process.on(sig, () => { stopping = true; server.close(() => process.exit(0)) })
}
