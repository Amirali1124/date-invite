/* ══════════════════════════════════════════════════════════
   یه قرار کوچیک — flow, map, time picker, result
   ══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = (s) => String(s).replace(/\d/g, d => FA[+d]);

const app      = $('#app');
const screens  = $$('.screen');
const HEART_SVG = "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path d=%22M12 21C6 16.5 3 13.4 3 9.8 3 7.1 5 5 7.5 5c1.6 0 3.3.8 4.5 2.4C13.2 5.8 14.9 5 16.5 5 19 5 21 7.1 21 9.8c0 3.6-3 6.7-9 11.2Z%22/></svg>')";

const state = {
  step: 0,
  place: null,      // { name, address, region, lat, lng }
  time:  { h: 19, m: 30 },
  foods: new Set(),
  otherFood: '',
  guests: { mode: null, names: '' }
};

/* ───────────────────────── بن ─────────────────────────
   این فهرست فقط برای بازخورد فوری داخل مرورگر است؛ نسخهٔ اصلی و
   غیرقابل‌دورزدنش BLOCKED_NAMES در سرور است. */

const BANNED = ['غزل', 'تینا', 'tina', 'ghazal'];

function norm(s){
  return String(s ?? '')
    .replace(/[ً-ْٰ‌‏‎ـ]/g, '')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[أإآا]/g, 'ا').replace(/[ؤو]/g, 'و').replace(/ئ/g, 'ی')
    .replace(/[ۀة]/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* تطبیق تکه‌ای تا «تینا محمدی» و «tina_123» هم بگیرند؛ نرمال‌سازیِ
   الف/واو عربی یوزرنیم انگلیسی را به فارسی می‌رساند. */
const stripNonWord = (s) => norm(s).replace(/[^\p{L}\p{N}]+/gu, '');

function bannedWord(text){
  const t = norm(text);
  const flat = stripNonWord(text);
  return BANNED.find(b =>
    t.includes(norm(b)) || (flat && flat.includes(stripNonWord(b)))
  );
}

const banEl = $('#ban');
let banned = false;

function showBan(){
  banned = true;
  banEl.hidden = false;
  $('#ban-close').focus({ preventScroll: true });
}
function hideBan(){
  banEl.hidden = true;
  banned = false;
}
$('#ban-close').addEventListener('click', hideBan);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !banEl.hidden) hideBan();
});

/* فیلدی که اسم بن در آن تایپ شده: پاپ‌آپ می‌آورد و جلوی ارسال را می‌گیرد */
function guard(el, test = bannedWord){
  if (!test(el.value)) return false;
  showBan();
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/* ───────────────────────── progress ───────────────────────── */

function buildProgress(){
  $$('.progress').forEach(list => {
    if (list.children.length) return;
    for (let i = 0; i < 4; i++) list.appendChild(document.createElement('li'));
  });
}

function paintProgress(){
  const idx = state.step - 1;                 // screens 1..4 are the questions
  $$('.progress').forEach(list => {
    [...list.children].forEach((li, i) => {
      li.className = i < idx ? 'is-done' : i === idx ? 'is-current' : '';
      if (!li.firstChild) {
        const d = document.createElement('span');
        d.className = 'dot';
        li.appendChild(d);
      }
    });
  });
}

/* ───────────────────────── navigation ───────────────────────── */

const SCENE = { 0: 'calm', 1: 'calm', 2: 'calm', 3: 'calm', 4: 'calm', 5: 'sunset' };

function go(next, dir){
  const from = screens[state.step];
  const to   = screens[next];
  const back = dir === 'back';
  state.step = next;

  paintProgress();
  app.dataset.scene = SCENE[next];

  if (from && from !== to){
    from.style.setProperty('--to-x', back ? '6%' : '-5%');
    from.classList.add('is-exit');
    const out = from;
    setTimeout(() => {
      out.classList.remove('is-exit');
      out.hidden = true;
      out.removeAttribute('aria-hidden');
    }, 240);
  }

  to.hidden = false;
  to.removeAttribute('hidden');
  to.style.setProperty('--from-x', back ? '6%' : '-5%');
  to.classList.remove('is-enter');
  void to.offsetWidth;
  to.classList.add('is-enter');

  onEnter(to, back);
  to.querySelector('.screen__body')?.scrollTo({ top: 0 });

  const h = $('h1,h2', to);
  if (h){ h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

function onEnter(sec, back){
  if (sec.dataset.screen === '1'){ map.invalidateSize({ animate: false }); }
  if (sec.dataset.screen === '2'){ jumpWheels(); syncPeriod(true); }
  if (sec.dataset.screen === '5'){ paintResult(); }
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  const next = +b.dataset.go;
  if (b.disabled){ nudge(b); return; }
  go(next);
}));
$$('[data-back]').forEach(b => b.addEventListener('click', () => {
  if (state.step > 0) go(state.step - 1, 'back');
}));

function nudge(el){
  const foot = el.closest('.screen__foot');
  const hint = foot && $('.hint:not([hidden])', foot);
  const row  = el.parentElement;
  row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
  if (hint){ hint.style.opacity = 0; setTimeout(() => hint.style.opacity = 1, 240); }
}

/* ══════════════════════════════════════════════════════════
   1 · place — Leaflet map + Nominatim search
   ══════════════════════════════════════════════════════════ */

const mapEl     = $('#map');
const input     = $('#place-input');
const list      = $('#place-results');
const clearBtn  = $('#place-clear');
const goPlace   = $('#go-place');
const venue     = $('#venue');
const pickTip   = $('#map-pick');

const map = L.map(mapEl, {
  zoomControl: false,
  attributionControl: true,
  dragging: true,
  tap: true
}).setView([35.7000, 51.4100], 13);

/* Esri's light-gray canvas basemap — keyless, and its muted palette sits
   inside the cream theme far better than raw OSM tiles. Labels ride on a
   second layer so streets stay readable. */
const baseOpts = { maxZoom: 18, minZoom: 3, attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors' };

/* own pane for the label overlay so it can sit above the base tiles */
map.createPane('labels');
map.getPane('labels').style.zIndex = '250';
map.getPane('labels').style.pointerEvents = 'none';

L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  ...baseOpts,
  className: 'map-tiles'
}).addTo(map);

L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
  ...baseOpts,
  className: 'map-labels',
  pane: 'labels'
}).addTo(map);

const pinIcon = L.divIcon({
  className: 'pin-marker',
  html: `<svg viewBox="0 0 34 44" aria-hidden="true">
    <path d="M17 1.5C9.8 1.5 4 7.3 4 14.5 4 24 17 42.5 17 42.5S30 24 30 14.5C30 7.3 24.2 1.5 17 1.5Z"
          fill="#D2546B" stroke="#fff" stroke-width="2.2"/>
    <circle cx="17" cy="14.5" r="5.2" fill="#fff"/>
    <circle cx="17" cy="41.5" r="7" fill="#D2546B" opacity=".3"/>
  </svg>`,
  iconSize: [34, 44], iconAnchor: [17, 43], popupAnchor: [0, -40]
});

let marker = null;

function setPlace(p, opts = {}){
  state.place = p;
  if (marker){
    marker.setLatLng([p.lat, p.lng]);
  } else {
    marker = L.marker([p.lat, p.lng], { icon: pinIcon, draggable: true, title: p.name }).addTo(map);
    marker.on('dragend', e => {
      const ll = e.target.getLatLng();
      reverseGeocode(ll.lat, ll.lng);
    });
  }

  $('#venue-name').textContent = p.name;
  $('#venue-addr').textContent = p.address || 'آدرس مشخص نشده';
  const reg = $('#venue-region');
  reg.textContent = p.region || '';
  reg.hidden = !p.region;
  venue.hidden = false;
  venue.style.animation = 'none'; void venue.offsetWidth; venue.style.animation = '';
  pickTip.hidden = true;
  goPlace.disabled = false;
  $('#place-hint').textContent = 'خوشمونده؟ بریم مرحله بعد';

  if (opts.pan !== false) map.panTo([p.lat, p.lng], { animate: true });
  hideResults();
}

map.on('dragend', () => {
  const c = map.getCenter();
  reverseGeocode(c.lat, c.lng);
});

/* Nominatim مکان را به اجزای مختلف می‌شکند؛ شهر و استان جدا از
   محلهٔ محلی‌اند، پس جدا نگه داشته می‌شوند تا در خطی جدا نشان داده شوند. */
const uniq = (...xs) => [...new Set(xs.filter(Boolean))];

function regionOf(a){
  const city  = a.city || a.town || a.village || a.municipality || a.county || ''
  const state = a.state || a.region || ''
  if (city && state && norm(city) === norm(state)) return state
  return uniq(city, state).join('، ')
}

/* reverse geocode — Nominatim */
const revCache = new Map();
let revTimer = null;
function reverseGeocode(lat, lng){
  const key = lat.toFixed(4) + ',' + lng.toFixed(4);
  if (revCache.has(key)){ applyReverse(lat, lng, revCache.get(key)); return; }
  clearTimeout(revTimer);
  revTimer = setTimeout(async () => {
    try{
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fa&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`;
      const j = await (await fetch(url)).json();
      const a = j.address || {};
      const place = a.neighbourhood || a.quarter || a.city_district || a.suburb || a.city || a.town || a.village || '';
      const road  = a.road || a.pedestrian || a.footway || '';
      const no    = a.house_number ? `پلاک ${fa(a.house_number)}` : '';
      const bits  = [road && `${road}${no ? '، ' + no : ''}`, place].filter(Boolean);
      const name  = j.name || place || 'مکان انتخاب‌شده';
      const addr  = bits.join('، ') || 'آدرس مشخص نشده';
      const r = { name, addr, region: regionOf(a) };
      revCache.set(key, r);
      applyReverse(lat, lng, r);
    }catch{ /* offline — keep the pin, no card */ }
  }, 420);
}
function applyReverse(lat, lng, r){
  if (state.place && Math.abs(state.place.lat - lat) < 1e-4 && Math.abs(state.place.lng - lng) < 1e-4) return;
  setPlace({ name: r.name, address: r.addr, region: r.region, lat, lng }, { pan: false });
}

/* ── forward search ── */
let searchTimer = null, abort = null;

input.addEventListener('input', () => {
  clearBtn.hidden = !input.value;
  clearTimeout(searchTimer);
  /* جستجوی خودِ اسم بن پیش از رفتن به سرور متوقف می‌شود؛ ولی «کافه غزل»
     یک جستجوی عادی است و نباید بن بدهد */
  if (guard(input)){
    hideResults();
    return;
  }
  const q = input.value.trim();
  if (q.length < 2){ hideResults(); return; }
  searchTimer = setTimeout(() => search(q), 480);
});

input.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ input.value = ''; clearBtn.hidden = true; hideResults(); input.blur(); }
  if (e.key === 'Enter'){ e.preventDefault(); clearTimeout(searchTimer); if (input.value.trim().length >= 2) search(input.value.trim()); }
});

clearBtn.addEventListener('click', () => {
  input.value = ''; clearBtn.hidden = true; hideResults(); input.focus();
});

async function search(q){
  abort?.abort();
  abort = new AbortController();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=fa&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
  try{
    const res = await fetch(url, { signal: abort.signal, headers: { Accept: 'application/json' } });
    const rows = await res.json();
    renderResults(rows, q);
  }catch(e){
    if (e.name !== 'AbortError') showResults([{
      name: 'نتیجه‌ای پیدا نشد؛ می‌تونی روی نقشه نقطه بذاری',
      addr: 'اینترنت در دسترس نیست', lat: null
    }]);
  }
}

function renderResults(rows, q){
  if (!rows.length){
    showResults([{ name: `«${q}» پیدا نشد`, addr: 'شاید املای دیگری رو امتحان کنی', lat: null }]);
    return;
  }
  showResults(rows.map(r => ({
    name: r.display_name.split(',')[0].trim(),
    addr: r.display_name.split(',').slice(1, 4).join('،').trim(),
    /* نام جستجو فقط نام مکان است؛ استان/شهر از همان رشته بیرون کشیده می‌شود */
    region: regionOf(r.address || {}),
    lat: +r.lat, lng: +r.lon
  })));
}

function showResults(items){
  list.innerHTML = '';
  items.forEach(it => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<svg class="i r-ico" viewBox="0 0 24 24"><use href="#i-pin"></use></svg>
      <span><span></span><span class="r-sub"></span><span class="r-region"></span></span>`;
    b.querySelector('span span').textContent = it.name;
    b.querySelector('.r-sub').textContent = it.addr;
    const reg = b.querySelector('.r-region');
    reg.textContent = it.region || '';
    reg.hidden = !it.region;
    if (it.lat != null){
      b.addEventListener('click', () => {
        setPlace({ name: it.name, address: it.addr, region: it.region, lat: it.lat, lng: it.lng });
        map.setView([it.lat, it.lng], 16);
        input.value = it.name;
        clearBtn.hidden = false;
      });
    } else {
      b.disabled = true;
      b.style.opacity = '.7';
    }
    li.appendChild(b);
    list.appendChild(li);
  });
  list.hidden = false;
}

function hideResults(){ list.hidden = true; }

document.addEventListener('click', e => {
  if (!list.hidden && !e.target.closest('.search-wrap')) hideResults();
});

$('#zoom-in').addEventListener('click', () => map.zoomIn());
$('#zoom-out').addEventListener('click', () => map.zoomOut());

setTimeout(() => { if (!state.place) pickTip.hidden = false; }, 1400);

/* ══════════════════════════════════════════════════════════
   2 · time — two snapping wheels
   ══════════════════════════════════════════════════════════ */

const wheelH = $('#wheel-h');
const wheelM = $('#wheel-m');
const periodEl = $('#period');
const clockEl = $('.clock');

/* Item height comes from CSS and differs by breakpoint (60px on short phones).
   Reading the custom property works even while the screen is hidden and always
   matches the current breakpoint — measuring the DOM does neither, which made
   the wheel pick the wrong row on mobile. */
function itemH(){
  const v = parseFloat(getComputedStyle(clockEl).getPropertyValue('--item-h'));
  if (v) return v;
  const m = wheelH.querySelector('li').getBoundingClientRect().height;
  return m || 70;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS  = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const CALM  = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fillWheel(el, arr, sel){
  el.innerHTML = '';
  arr.forEach((v, i) => {
    const li = document.createElement('li');
    li.textContent = fa(v);
    li.dataset.i = i;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === sel));
    el.appendChild(li);
  });
}

const hIdx = () => HOURS.indexOf(String(state.time.h).padStart(2, '0'));
const mIdx = () => MINS.indexOf(state.time.m);
const clamp = (n, max) => Math.min(max, Math.max(0, n));

/* the wheel's padding-block centres every snapped item, so scrollTop === index × item height */
const topOf = (idx) => idx * itemH();

/* A display:none scroller reports scrollTop 0, and this screen is hidden whenever
   the user moves on — so the resting position can no longer be read at that point.
   The value therefore has to be committed the moment the wheel comes to rest. */
let settleTimer = null;
let selfScrollUntil = 0;

function onWheelSettle(){
  /* ignore the intermediate frames of a scroll we triggered ourselves — reading
     one mid-animation would commit a value the user never chose */
  if (performance.now() < selfScrollUntil) return;
  const h = clamp(Math.round(wheelH.scrollTop / itemH()), wheelH.children.length - 1);
  const m = clamp(Math.round(wheelM.scrollTop / itemH()), wheelM.children.length - 1);
  if (h === hIdx() && m === mIdx()) return;
  commit(h, m, wheelH);
}

/* only the wheel that actually moved may drive a commit */
function watchSettle(src){
  clearTimeout(settleTimer);
  settleTimer = setTimeout(onWheelSettle, 220);
}
window.addEventListener('scroll', e => {
  if (e.target === wheelH || e.target === wheelM) watchSettle(e.target);
}, true);

let touchSettling = false;

function paintWheel(el, idx, scroll = true){
  [...el.children].forEach((li, i) => {
    const on = i === idx;
    li.setAttribute('aria-selected', String(on));
    li.style.opacity = on ? '1' : Math.abs(i - idx) === 1 ? '.6' : '.3';
  });
  if (scroll){
    /* smooth for a deliberate step, instant when a tap/drag already moved the
       scroller — otherwise the animation fights the finger and the row the user
       tapped ends up out of step with the committed value */
    selfScrollUntil = performance.now() + 600;
    el.scrollTo({ top: topOf(idx), behavior: (CALM || touchSettling) ? 'auto' : 'smooth' });
  }
}

/* a display:none scroller has no scrollable box yet, so this has to wait for
   layout — otherwise the jump lands on 0 */
function jumpWheels(){
  selfScrollUntil = performance.now() + 600;
  wheelH.scrollTop = topOf(hIdx());
  wheelM.scrollTop = topOf(mIdx());
  requestAnimationFrame(recentre);
}

function commit(h, m, source){
  const hi = clamp(h, 23), mi = clamp(m, 11);
  state.time.h = +HOURS[hi];
  state.time.m = MINS[mi];
  paintWheel(wheelH, hi, source !== wheelH);
  paintWheel(wheelM, mi, source !== wheelM);
  syncPeriod();
}

/* Keep the highlighted row under the centre band after any change. This snaps
   instantly rather than smooth-scrolling, so the visible row always matches the
   committed value — a lingering animation reads as "it didn't select that". */
function recentre(){
  selfScrollUntil = performance.now() + 600;
  wheelH.scrollTo({ top: topOf(hIdx()), behavior: 'auto' });
  wheelM.scrollTo({ top: topOf(mIdx()), behavior: 'auto' });
}

function bindWheel(el){
  let t;

  el.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(onWheelSettle, 160);
  }, { passive: true });

  /* tapping an item is the most reliable gesture on a phone, and it works even
     where a flick-scroll would otherwise be swallowed */
  /* Commit on pointerdown, not click. Clicking a focused item inside a scroller
     makes the browser scroll it into view, which would yank the *other* wheel
     (focus lives on the previously used wheel) before the click lands. Taking
     the action first means that default has nothing left to act on. */
  const pick = e => {
    const li = e.target.closest('li');
    if (!li) return;
    if (el === wheelH) el.blur();
    e.preventDefault();
    touchSettling = true;
    commit(el === wheelH ? +li.dataset.i : hIdx(), el === wheelH ? mIdx() : +li.dataset.i);
    setTimeout(() => { touchSettling = false; }, 400);
  };
  el.addEventListener('mousedown', pick);
  el.addEventListener('touchstart', pick, { passive: false });

  el.addEventListener('keydown', e => {
    const d = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (d == null) return;
    e.preventDefault();
    const i = clamp((el === wheelH ? hIdx() : mIdx()) + d, el.children.length - 1);
    commit(el === wheelH ? i : hIdx(), el === wheelH ? mIdx() : i);
  });

  /* drag the wheel with a finger: move the scroller directly, then let the
     settle handler snap and commit */
  let startY = 0, startTop = 0, dragging = false, moved = 0;
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startTop = el.scrollTop;
    dragging = true; moved = 0;
    selfScrollUntil = 0;               // a real finger outranks any pending self-scroll
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!dragging || e.touches.length !== 1) return;
    const dy = startY - e.touches[0].clientY;
    moved = Math.abs(dy);
    if (moved < 4) return;              // let taps through as clicks
    e.preventDefault();
    selfScrollUntil = 0;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = Math.min(max, Math.max(0, startTop + dy));
  }, { passive: false });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (moved >= 4){
      touchSettling = true;
      onWheelSettle();
      setTimeout(() => { touchSettling = false; }, 400);
    }
  };
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });
}

function syncPeriod(instant){
  const h = state.time.h;
  let label, icon;
  if (h < 5)       { label = 'نیمه‌شب';   icon = 'i-moon'; }
  else if (h < 11) { label = 'صبح';       icon = 'i-sun'; }
  else if (h < 15) { label = 'ظهر';       icon = 'i-sun'; }
  else if (h < 20) { label = 'عصر';       icon = 'i-sun'; }
  else             { label = 'شب';        icon = 'i-moon'; }

  periodEl.innerHTML = `<svg class="i" viewBox="0 0 24 24"><use href="#${icon}"></use></svg> ${label}`;
  periodEl.dataset.period = label;
  if (!instant){
    periodEl.classList.remove('is-swap'); void periodEl.offsetWidth; periodEl.classList.add('is-swap');
  }
}

fillWheel(wheelH, HOURS, hIdx());
fillWheel(wheelM, MINS, mIdx());
paintWheel(wheelH, hIdx());
paintWheel(wheelM, mIdx());

bindWheel(wheelH);
bindWheel(wheelM);

$$('.clock__step').forEach(b => b.addEventListener('click', () => {
  const [k, d] = b.dataset.step.split(':');
  const delta = +d;
  if (k === 'hour') commit(hIdx() + delta, mIdx());
  else             commit(hIdx(), mIdx() + delta);
}));

/* ══════════════════════════════════════════════════════════
   3 · food
   ══════════════════════════════════════════════════════════ */

const FOODS = [
  { g: '🍕', t: 'پیتزا' },
  { g: '🍔', t: 'برگر' },
  { g: '🍝', t: 'پاستا' },
  { g: '🍣', t: 'غذای آسیایی' },
  { g: '🍟', t: 'فست‌فود' },
  { g: '☕', t: 'کافه و دسر' },
  { g: '🍲', t: 'هرچی تو بگی' },
  { g: '✏️', t: 'چیز دیگه‌ای تو ذهنمه...' }
];

const grid = $('#food-grid');
const otherField = $('#food-other-field');
const otherInput = $('#food-other');
const goFood = $('#go-food');
const OTHER = 'other';

FOODS.forEach((f, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'card';
  b.setAttribute('aria-pressed', 'false');
  b.dataset.key = i === FOODS.length - 1 ? OTHER : f.t;
  b.innerHTML = `<span class="dot"><svg class="i" viewBox="0 0 24 24"><use href="#i-check"></use></svg></span>
                 <span class="glyph">${f.g}</span><span>${f.t}</span>`;
  b.addEventListener('click', () => toggleFood(b.dataset.key));
  grid.appendChild(b);
});

function toggleFood(key){
  if (key === OTHER){
    otherField.hidden = !otherField.hidden;
    state.foods.has(OTHER) ? state.foods.delete(OTHER) : state.foods.add(OTHER);
    if (!otherField.hidden) otherInput.focus({ preventScroll: true });
  } else {
    state.foods.has(key) ? state.foods.delete(key) : state.foods.add(key);
  }
  paintFood();
}

function paintFood(){
  $$('.card', grid).forEach(c => {
    const on = state.foods.has(c.dataset.key);
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-pressed', String(on));
  });
  const needOther = state.foods.has(OTHER) && otherInput.value.trim().length > 0;
  const ready = state.foods.size > 0 && (!state.foods.has(OTHER) || needOther);
  goFood.disabled = !ready;
  $('#food-block').textContent = ready ? 'انتخاب خوبی بود' : 'حداقل یه گزینه انتخاب کن';
  $('#food-hint').textContent = state.foods.size > 1
    ? `${fa(state.foods.size)} گزینه انتخاب شده — هرچقدر دوست داری`
    : 'می‌تونی چندتا رو با هم انتخاب کنی';
}

otherInput.addEventListener('input', () => {
  if (guard(otherInput)) return;
  state.otherFood = otherInput.value.trim();
  paintFood();
});

/* ══════════════════════════════════════════════════════════
   4 · companions
   ══════════════════════════════════════════════════════════ */

const guestsField = $('#guests-field');
const guestsInput = $('#guests');
const goGuests = $('#go-guests');

$$('.choice').forEach(c => c.addEventListener('click', () => {
  const v = c.dataset.value;
  state.guests.mode = state.guests.mode === v ? null : v;
  const group = state.guests.mode === 'group';
  guestsField.hidden = !group;
  $$('.choice').forEach(x => {
    const on = x.dataset.value === state.guests.mode;
    x.classList.toggle('is-on', on);
    x.setAttribute('aria-checked', String(on));
  });
  if (group) guestsInput.focus({ preventScroll: true });
  else { state.guests.names = ''; guestsInput.value = ''; }
  paintGuests();
}));

guestsInput.addEventListener('input', () => {
  if (guard(guestsInput)) return;
  state.guests.names = guestsInput.value.trim();
  paintGuests();
});

function paintGuests(){
  const g = state.guests;
  const ready = g.mode === 'duo' || (g.mode === 'group' && g.names.length > 0);
  goGuests.disabled = !ready;
  $('#guests-block').textContent = !g.mode ? 'اول انتخاب کن با کیا بریم'
    : g.mode === 'group' && !g.names ? 'اسمشون رو بنویس' : 'آماده‌ای! ❤️';
}

/* ══════════════════════════════════════════════════════════
   5 · result
   ══════════════════════════════════════════════════════════ */

/* ارسال به تلگرام — سایت کاملاً سمت کلاینت است، پس این تنها راهی است که
   نتیجه به ربات می‌رسد. اگر کلید عمیق نبود یا سرور نبود، سایت عادی کار می‌کند. */
/* سایت روی GitHub Pages است و بک‌اند جای دیگری، پس آدرس API باید قابل
   تنظیم باشد. data-api روی <body> می‌آید؛ اگر نبود، هم‌ریشه فرض می‌شود. */
const API       = new URL(document.body.dataset.api || '/', location.origin);
API.pathname = '/api/result';
const inviteKey = new URLSearchParams(location.search).get('k') || '';
let autoSent    = false;

function paintResult(){
  const p = state.place;
  $('#r-place').textContent = p?.name || 'کافه فلان';
  $('#r-addr').textContent  = p?.address || 'خیابان ولیعصر، تهران';
  const rreg = $('#r-region');
  rreg.textContent = p?.region || '';
  rreg.hidden = !p?.region;

  $('#r-time').textContent = fa(String(state.time.h).padStart(2, '0')) + ':' + fa(String(state.time.m).padStart(2, '0'));
  $('#r-period').textContent = periodEl.dataset.period || 'عصر';

  const names = [...state.foods].filter(k => k !== OTHER).map(k => {
    const f = FOODS.find(x => x.t === k);
    return f ? `${f.g} ${f.t}` : k;
  });
  if (state.otherFood) names.push('✏️ ' + state.otherFood);
  $('#r-food').textContent = names.length ? names.join('، ') : 'هرچی تو بگی';
  const extra = $('#r-food-extra');
  extra.hidden = !state.otherFood;
  if (state.otherFood) extra.textContent = state.otherFood;

  $('#r-guests').textContent = state.guests.mode === 'group'
    ? state.guests.names
    : 'فقط خودمون دوتا';

  /* اگر از ربات آمده‌ایم، نتیجه را خودکار بفرست */
  if (inviteKey && !autoSent){
    showSendButton();
    sendToTelegram();
  } else if (!inviteKey){
    /* بدون کلید عمیق هیچ ارسالی انجام نمی‌شود — صریح بگو تا گیج نشود */
    $('#telegram-row').hidden = false;
    $('#telegram-status').textContent = 'برای فرستادن، از ربات لینک بگیر';
  }
}

/* ══════════════════════════════════════════════════════════
   ارسال نتیجه به تلگرام
   ══════════════════════════════════════════════════════════ */

function sendToTelegram(){
  if (!inviteKey || autoSent) return;
  autoSent = true;

  const foods = [...state.foods].filter(k => k !== OTHER);
  if (state.otherFood) foods.push(state.otherFood);

  const btn = $('#telegram-send');
  const status = $('#telegram-status');

  fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key: inviteKey,
      place:  state.place?.name || '',
      address: state.place?.address || '',
      region: state.place?.region || '',
      time:   fa(String(state.time.h).padStart(2, '0')) + ':' + fa(String(state.time.m).padStart(2, '0')),
      period: periodEl.dataset.period || '',
      foods,
      guests: state.guests.mode === 'group' ? state.guests.names : 'فقط خودمون دوتا'
    })
  })
    .then(async r => {
      /* Pages و هر جایی که سرور نیست، HTML برمی‌گرداند نه JSON — همان خطاست */
      let j = null
      try { j = await r.json() } catch {}
      return { ok: r.ok, j }
    })
    .then(({ ok, j }) => {
      if (ok && j && j.ok){
        status.textContent = 'فرستاده شد به تلگرام ✅';
        btn.disabled = true;
        btn.textContent = 'ارسال شد';
      }else if (j && j.banned){
        showBan();
      }else{
        /* اگر این صفحه از Pages باز شده باشد، این‌جا لو می‌دهیم */
        const onPages = /github\.io/i.test(location.host)
        status.textContent = onPages
          ? 'این نسخه بدون سرور است — از لینک ربات باز کن'
          : (j && j.error) || 'ارسال نشد'
        btn.disabled = false;
        console.warn('[telegram] send failed:', { status: ok ? 'body-error' : 'http', body: j })
      }
    })
    .catch(e => {
      status.textContent = 'اتصال به سرور برقرار نشد';
      btn.disabled = false;
      console.warn('[telegram] network error:', e)
    });
}

function showSendButton(){
  if (!inviteKey) return;
  $('#telegram-row').hidden = false;
}

$('#telegram-send').addEventListener('click', () => {
  autoSent = false;                 // اجازهٔ ارسال دوباره پس از خطا
  sendToTelegram();
});

$('#restart').addEventListener('click', () => {
  hideBan();
  state.place = null;
  state.time = { h: 19, m: 30 };
  state.foods.clear();
  state.otherFood = '';
  state.guests = { mode: null, names: '' };

  otherInput.value = '';
  guestsInput.value = '';
  otherField.hidden = true;
  guestsField.hidden = true;
  venue.hidden = true;
  goPlace.disabled = true;
  goFood.disabled = true;
  goGuests.disabled = true;
  $$('.card', grid).forEach(c => c.classList.remove('is-on'));
  $$('.choice').forEach(c => { c.classList.remove('is-on'); c.setAttribute('aria-checked', 'false'); });
  if (marker){ map.removeLayer(marker); marker = null; }

  commit(19, 6);
  paintFood(); paintGuests(); paintProgress();
  go(0, 'back');
});

/* ══════════════════════════════════════════════════════════
   ambient hearts on the sunset page
   ══════════════════════════════════════════════════════════ */

(function hearts(){
  const box = $('#hearts');
  if (!box) return;
  for (let i = 0; i < 11; i++){
    const el = document.createElement('i');
    el.style.left = (5 + Math.random() * 90) + '%';
    el.style.bottom = (-4 - Math.random() * 10) + '%';
    el.style.setProperty('--d', (13 + Math.random() * 11) + 's');
    el.style.setProperty('--dl', (-Math.random() * 20) + 's');
    el.style.width = el.style.height = (8 + Math.random() * 10) + 'px';
    box.appendChild(el);
  }
  box.style.setProperty('--h', HEART_SVG);
})();

/* ── keyboard: left-arrow goes back, like a page ── */
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea')) return;
  if (e.key === 'ArrowRight' && state.step > 0) go(state.step - 1, 'back');
  if (e.key === 'ArrowLeft'  && state.step < 5 && stepAnswered()) go(state.step + 1);
});

/* آیا سؤال مرحلهٔ جاری پاسخ داده شده؟ — هم دکمه‌ها، هم کشیدن، هم کیبورد
   از این تابع واحد استفاده می‌کنند تا قوانینشان واگرا نشود */
function stepAnswered(){
  if (state.step === 0) return true;                   // صفحهٔ شروع
  if (state.step === 1) return !goPlace.disabled;      // مکان
  if (state.step === 2) return true;                   // ساعت همیشه مقداری دارد
  if (state.step === 3) return !goFood.disabled;       // غذا
  if (state.step === 4) return !goGuests.disabled;     // همراه
  return false;                                        // نتیجه
}

/* ── swipe between questions (horizontal, on the body only) ── */
(() => {
  let x0 = null, y0 = null, locked = false;

  /* جاهایی که کشیدن افقی معنای دیگری دارد و نباید صفحه را عوض کند:
     نقشه (پن ماه می‌چرخد)، چرخ‌های ساعت، ورودی متن و نتایج جستجو */
  const NO_SWIPE = '.leaflet-container, .wheel, input, textarea, .results';

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    if (e.target.closest && e.target.closest(NO_SWIPE)){ x0 = null; return }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; locked = false;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (x0 == null || locked) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 68 && Math.abs(dx) > Math.abs(dy) * 1.8){
      locked = true;
      if (dx > 0 && state.step > 0) go(state.step - 1, 'back');   // کشیدن به راست = عقب (RTL)
      else if (dx < 0 && state.step < 5 && stepAnswered()) go(state.step + 1);
    }
    x0 = null;
  }, { passive: true });
})();

/* ── boot ── */
buildProgress();
paintProgress();
paintFood();
paintGuests();
app.dataset.scene = 'calm';
mapEl.setAttribute('aria-hidden', 'true');
setTimeout(() => map.invalidateSize(), 60);

})();
