// Admin review page, served by the worker at /admin. Text is always inserted
// with textContent, never as HTML, so a submitted dedication can't inject markup.
export const adminPage = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>献辞审核 · masteryau.com</title>
<style>
  :root { --ink:#06070b; --text:#e9e4d6; --dim:#8f8a7c; --gold:#d8b46a; --line:rgba(216,180,106,.22); --red:#d77a6a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ink); color:var(--text); font:15px/1.7 "Noto Serif SC","Songti SC",serif; }
  main { max-width:760px; margin:0 auto; padding:40px 20px 80px; }
  h1 { font-weight:500; font-size:24px; margin:0 0 4px; }
  h2 { font-weight:500; font-size:18px; margin:40px 0 12px; color:var(--gold); }
  p.sub { margin:0 0 24px; color:var(--dim); font-size:13px; }
  form.login { display:flex; gap:8px; }
  input, textarea { background:transparent; border:1px solid var(--line); color:var(--text); font:inherit; padding:10px 12px; }
  input:focus, textarea:focus { outline:none; border-color:var(--gold); }
  button { font:inherit; padding:8px 16px; border:1px solid var(--gold); background:transparent; color:var(--gold); cursor:pointer; }
  button.primary { background:var(--gold); color:var(--ink); }
  button.danger { border-color:var(--red); color:var(--red); }
  button:disabled { opacity:.4; cursor:default; }
  ul { list-style:none; margin:0; padding:0; }
  li { border-top:1px solid var(--line); padding:16px 0; }
  li:last-child { border-bottom:1px solid var(--line); }
  .text { font-size:17px; width:100%; display:block; resize:vertical; min-height:2.6em; }
  .meta { color:var(--dim); font-size:12px; margin:6px 0 10px; }
  .flag { display:inline-block; margin-left:8px; padding:0 6px; border:1px solid var(--red); color:var(--red); font-size:12px; }
  .actions { display:flex; gap:8px; }
  .empty { color:var(--dim); padding:16px 0; border-top:1px solid var(--line); }
  .status { min-height:1.7em; color:var(--dim); font-size:13px; margin-top:8px; }
  .hidden { display:none !important; }
</style>
</head>
<body>
<main>
  <h1>献辞审核</h1>
  <p class="sub">访客提交的献辞在这里审核。只有点“通过”的才会出现在 masteryau.com 的星空里。</p>

  <form class="login" id="login">
    <input id="token" type="password" placeholder="审核密码" autocomplete="current-password" required>
    <button class="primary" type="submit">进入</button>
  </form>
  <p class="status" id="status" role="status"></p>

  <section id="app" class="hidden">
    <h2>待审核 <span id="pendingCount"></span></h2>
    <ul id="pending"></ul>
    <h2>已展示 <span id="approvedCount"></span></h2>
    <ul id="approved"></ul>
    <p style="margin-top:32px"><button id="logout">退出</button></p>
  </section>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  let token = sessionStorage.getItem('masteryau-admin') || '';
  const say = (t) => { $('status').textContent = t; };
  const fmt = (iso) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { logout(); throw new Error('密码不正确'); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || ('请求失败 ' + res.status));
    return res.json();
  }

  function row(item, kind) {
    const li = document.createElement('li');
    const text = document.createElement(kind === 'pending' ? 'textarea' : 'div');
    text.className = 'text';
    if (kind === 'pending') { text.value = item.text; text.maxLength = 40; text.setAttribute('aria-label', '献辞内容，可在通过前修改'); }
    else text.textContent = item.text;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = (kind === 'pending' ? '提交于 ' + fmt(item.at) : '通过于 ' + fmt(item.approvedAt));
    (item.flags || []).forEach((f) => { const s = document.createElement('span'); s.className = 'flag'; s.textContent = f; meta.appendChild(s); });
    const actions = document.createElement('div');
    actions.className = 'actions';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = async () => { b.disabled = true; try { await fn(); await load(); } catch (e) { say(e.message); b.disabled = false; } }; actions.appendChild(b); };
    if (kind === 'pending') {
      btn('通过', 'primary', () => api('/api/admin/approve', { id: item.id, text: text.value }).then(() => say('已通过')));
      btn('删除', 'danger', () => api('/api/admin/reject', { id: item.id }).then(() => say('已删除')));
    } else {
      btn('撤下', 'danger', () => api('/api/admin/unpublish', { id: item.id }).then(() => say('已撤下')));
    }
    li.append(text, meta, actions);
    return li;
  }

  function fill(listId, countId, items, kind, emptyText) {
    const ul = $(listId); ul.replaceChildren();
    $(countId).textContent = items.length ? '（' + items.length + '）' : '';
    if (!items.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = emptyText; ul.appendChild(li); return; }
    items.forEach((it) => ul.appendChild(row(it, kind)));
  }

  async function load() {
    const data = await api('/api/admin/list');
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    fill('pending', 'pendingCount', data.pending, 'pending', '没有待审核的献辞。');
    fill('approved', 'approvedCount', data.approved, 'approved', '还没有展示中的献辞。');
  }

  function logout() { token = ''; sessionStorage.removeItem('masteryau-admin'); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }

  $('login').onsubmit = async (e) => {
    e.preventDefault(); token = $('token').value; say('');
    try { await load(); sessionStorage.setItem('masteryau-admin', token); $('token').value = ''; } catch (err) { say(err.message); }
  };
  $('logout').onclick = () => { logout(); say('已退出'); };
  if (token) load().catch((e) => say(e.message));
</script>
</body>
</html>`
