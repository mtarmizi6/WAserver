const $ = s => document.querySelector(s), view = $('#view'), tg = window.Telegram?.WebApp;
const demo = new URLSearchParams(location.search).get('demo') === '1';
let demoApi;
if (demo) demoApi = (await import('./demo.js')).demoApi;

let state = {
  tab: 'home',
  kind: 'all',
  owner: 'all',
  client: '',
  page: 1,
  key: null,
  detail: null,
  rows: null,
  overview: null,
  jobList: null,
  morePage: '',
  q: '',
  account: '',
  status: '',
  resultPage: 1,
  accountPage: 1,
  allResults: false,
  // Chatbot State
  chatbotOverview: null,
  chatbotConfig: null,
  chatbotKb: [],
  chatbotLeads: [],
  chatbotLeadPage: 1,
  chatbotLeadTotal: 0,
  simMessages: [],
  simStep: 'START',
  simLoading: false,
  editingKb: null
};

let busy = false, refreshQueued = false, actionBusy = false, connected = false, lastAt = null,
  authFailed = false, generation = 0, overviewFetched = 0, confirmationTarget = null;

const types = {
  post: ['Auto Post', 'bullhorn'],
  join: ['Auto Join Group', 'link'],
  gs: ['Status Group', 'comment-dots'],
  sync: ['Sync Group', 'arrows-rotate'],
  fu: ['Auto Follow-Up', 'comments']
};

const labels = {
  QUOTA: 'Kuota habis', DRAFT: 'Draf', RUNNING: 'Berjalan', WAITING: 'Menunggu',
  PAUSED: 'Dijeda', STOPPED: 'Dihentikan', COMPLETED: 'Selesai', SUCCESS: 'Berjaya',
  FAILED: 'Gagal', SKIPPED: 'Dilangkau', ACCEPTED: 'ACK OK', UNKNOWN: 'Belum pasti',
  ALREADY: 'Sudah ahli', APPROVAL: 'Tunggu admin', PENDING: 'Belum proses',
  PROCESSING: 'Memproses', IN_FLIGHT: 'Memproses', ONLINE: 'Online', OFFLINE: 'Offline',
  QUALIFIED: 'Prospek Layak', HANDOFF: 'Menunggu Admin', NEW: 'Baru', COLD: 'Sejuk'
};

const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = n => `<i class="fa-solid fa-${n}" aria-hidden="true"></i>`;
const n = v => Number(v || 0).toLocaleString('ms-MY');
const time = v => v ? new Date(v).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const date = v => v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const tone = s => ['RUNNING', 'COMPLETED', 'SUCCESS', 'ACCEPTED', 'ONLINE', 'QUALIFIED'].includes(s) ? 'green' : ['FAILED', 'OFFLINE', 'COLD'].includes(s) ? 'red' : ['WAITING', 'PAUSED', 'QUOTA', 'UNKNOWN', 'APPROVAL', 'HANDOFF'].includes(s) ? 'amber' : 'blue';
const pill = (s, text) => `<span class="pill ${tone(s)}"><span class="dot"></span>${e(text || labels[s] || s)}</span>`;
const link = (title, desc, i, action, value = '') => `<button class="link-row" data-${action}="${e(value)}"><span class="icon-tile">${icon(i)}</span><span><strong>${e(title)}</strong><small>${e(desc)}</small></span>${icon('chevron-right')}</button>`;
const empty = (title, copy, cmd = '') => `<section class="card empty">${icon('robot')}<h2>${e(title)}</h2><p>${e(copy)}</p>${cmd ? `<button class="btn" data-bot="${e(cmd)}">${icon('robot')} Buka bot · ${e(cmd)}</button>` : ''}</section>`;

function setConnected(ok, message) {
  connected = ok;
  document.body.classList.toggle('offline', !ok);
  $('#connection').className = 'connection ' + (ok ? 'live' : 'warn');
  $('#connection').innerHTML = `${ok ? '<span class="dot"></span>' : icon('circle-exclamation')} ${e(demo ? 'DATA CONTOH · ' + (message || 'Simulasi interaktif') : message || ('Dikemas kini ' + time(lastAt) + ' MYT'))}`;
}

function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}

async function api(path, params = {}, body) {
  if (demo) return demoApi(path, params, body);
  const init = tg?.initData;
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(init ? { Authorization: 'tma ' + init } : {})
  };
  const url = '/api/' + path + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(9000)
  });
  const result = await r.json();
  if (!r.ok) {
    if (r.status === 401) authFailed = true;
    throw new Error(result.error || 'Sambungan terganggu.');
  }
  return result;
}

function pager(page, pages, scope = 'page') {
  return pages > 1 ? `<div class="pager"><button class="icon-btn" data-${scope}="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Halaman sebelum">${icon('chevron-left')}</button><span>Halaman ${page} / ${pages}</span><button class="icon-btn" data-${scope}="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Halaman seterusnya">${icon('chevron-right')}</button></div>` : '';
}

/* ==================== VIEWS ==================== */

function home() {
  const o = state.chatbotOverview || {
    config: { enabled: true, botName: 'WhatsApp Smart Bot' },
    stats: { totalLeads: 0, qualifiedLeads: 0, newLeads: 0, totalKb: 0, totalMessages: 0 },
    recentLeads: [],
    onlineAccounts: []
  };

  const isEnabled = o.config?.enabled;

  return `
    <section class="hero">
      <div class="kicker">WhatsApp Smart Chatbot · Live Control</div>
      <h1>${e(o.config?.botName || 'WhatsApp Smart Bot')}</h1>
      <p>Melayan pertanyaan pelanggan 24/7, menapis prospek berminat & notifikasi ke Telegram.</p>
    </section>

    <div class="stats">
      <div class="stat">
        <span class="icon-tile">${icon('fire')}</span>
        <span>
          <small>Prospek Layak (Hot)</small>
          <strong style="color:var(--deep)">${n(o.stats?.qualifiedLeads)}</strong>
        </span>
      </div>
      <div class="stat">
        <span class="icon-tile">${icon('users')}</span>
        <span>
          <small>Jumlah Prospek</small>
          <strong>${n(o.stats?.totalLeads)}</strong>
        </span>
      </div>
      <div class="stat">
        <span class="icon-tile">${icon('book-open')}</span>
        <span>
          <small>Knowledge Base</small>
          <strong>${n(o.stats?.totalKb)}</strong>
        </span>
      </div>
      <div class="stat">
        <span class="icon-tile">${icon('comments')}</span>
        <span>
          <small>Mesej Diproses</small>
          <strong>${n(o.stats?.totalMessages)}</strong>
        </span>
      </div>
    </div>

    <section class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>${icon('robot')} Status Auto-Trigger Chatbot</h2>
        ${pill(isEnabled ? 'ONLINE' : 'OFFLINE', isEnabled ? 'Aktif' : 'Dijeda')}
      </div>
      <p style="font-size:12px;margin:8px 0 14px">
        ${isEnabled
          ? 'Bot bersedia melayan sebarang mesej WhatsApp baharu, mengutip nama & emel, serta menjalankan tapisan soalan.'
          : 'Chatbot sedang dijeda sementara waktu. Mesej masuk tidak akan dijawab automatik.'}
      </p>
      <div class="actions">
        <button class="btn ${isEnabled ? 'amber' : 'primary'}" data-toggle-bot="${isEnabled ? '0' : '1'}">
          ${icon(isEnabled ? 'pause' : 'play')} ${isEnabled ? 'Jeda Bot' : 'Aktifkan Bot'}
        </button>
        <button class="btn" data-nav="simulator">
          ${icon('comments')} Uji Dalam Simulator
        </button>
      </div>
    </section>

    <div class="section-label">
      <h2>${icon('bolt')} Prospek Terbaharu</h2>
      <button class="text-btn" data-nav="leads">Lihat Semua (${n(o.stats?.totalLeads)}) ${icon('arrow-right')}</button>
    </div>

    ${o.recentLeads?.length ? o.recentLeads.slice(0, 3).map(l => leadRow(l)).join('') : empty('Belum ada prospek', 'Prospek akan tersenarai sebaik sahaja pelanggan memulakan perbualan WhatsApp.')}

    <div class="section-label">
      <h2>${icon('mobile-screen-button')} Akaun WhatsApp Pengendali</h2>
      <button class="text-btn" data-more="accounts">Urus Akaun</button>
    </div>
    <section class="card">
      ${(o.onlineAccounts?.length ? o.onlineAccounts : [{ id: 1, phone: '60123456789', label: 'Akaun Utama', status: 'ONLINE' }]).map(a => `
        <div class="account-row">
          <span class="account-avatar"><i class="fa-brands fa-whatsapp"></i></span>
          <div class="account-info">
            <strong>${e(a.label || 'Akaun ' + a.id)} <span class="account-phone">· +${e(a.phone)}</span></strong>
            <small>Sedia melayan pertanyaan masuk</small>
          </div>
          ${pill(a.status || 'ONLINE')}
        </div>
      `).join('')}
    </section>
  `;
}

function leadRow(l) {
  const isHot = l.status === 'QUALIFIED' || l.status === 'HANDOFF';
  const waUrl = `https://wa.me/${e(l.phone)}?text=${encodeURIComponent(`Salam ${l.name || ''}, saya Pegawai Jualan. Terima kasih kerana berhubung dengan kami!`)}`;

  const answers = l.qualificationAnswers || {};
  const answerEntries = Object.entries(answers);

  return `
    <div class="lead-item">
      <div class="lead-item-top">
        <div>
          <div class="lead-title">${e(l.name || 'Pelanggan WhatsApp')}</div>
          <div class="lead-phone">+${e(l.phone)} ${l.email ? `· <span style="font-family:inherit">${e(l.email)}</span>` : ''}</div>
        </div>
        <div style="text-align:right">
          <span class="lead-score-badge ${isHot ? 'hot' : ''}">Skor: ${n(l.qualificationScore)}/100</span>
          <div style="margin-top:4px">${pill(l.status)}</div>
        </div>
      </div>

      ${answerEntries.length > 0 ? `
        <div class="lead-qa-list">
          ${answerEntries.slice(0, 2).map(([k, v]) => `
            <div class="lead-qa-row">
              <span class="lead-qa-q">${e(v.question || k)}:</span>
              <span class="lead-qa-a"> ${e(v.selectedText || v.answer || v)}</span>
            </div>
          `).join('')}
          ${answerEntries.length > 2 ? `<div style="font-size:10px;color:var(--deep);margin-top:4px">+ ${answerEntries.length - 2} jawapan lain disahkan</div>` : ''}
        </div>
      ` : ''}

      <div class="lead-actions">
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-wa-direct">
          <i class="fa-brands fa-whatsapp"></i> Chat WhatsApp
        </a>
        <button class="btn" style="flex:1" data-lead-detail="${e(l.phone)}">
          ${icon('eye')} Butiran Tapisan
        </button>
      </div>
    </div>
  `;
}

function leadsView() {
  const items = state.chatbotLeads || [];
  const statusFilter = state.status || '';

  return `
    <section class="hero">
      <div class="kicker">Pengurusan Prospek</div>
      <h1>Senarai Prospek</h1>
      <p>Pelanggan yang telah disaring dan dinilai tahap minat mereka secara automatik.</p>
    </section>

    <div class="filters">
      ${[
        ['', 'Semua'],
        ['QUALIFIED', 'Prospek Layak (Hot)'],
        ['HANDOFF', 'Menunggu Admin'],
        ['NEW', 'Baru'],
        ['COLD', 'Sejuk']
      ].map(([k, v]) => `
        <button class="filter ${statusFilter === k ? 'active' : ''}" data-lead-filter="${k}">
          ${v}
        </button>
      `).join('')}
    </div>

    <div class="search">
      ${icon('magnifying-glass')}
      <input id="lead-search" type="search" placeholder="Cari nama, nombor telefon, atau emel..." value="${e(state.q)}">
    </div>

    ${items.length ? items.map(l => leadRow(l)).join('') : empty('Tiada prospek ditemui', 'Belum ada prospek yang sepadan dengan carian ini.')}

    <div class="actions">
      <button class="btn full" data-export-leads="1">
        ${icon('download')} Muat Turun Senarai Prospek (CSV)
      </button>
    </div>
  `;
}

function kbView() {
  const items = state.chatbotKb || [];

  return `
    <section class="hero">
      <div class="kicker">Pangkalan Pengetahuan</div>
      <h1>Knowledge Base & Keyword</h1>
      <p>Tetapkan kata kunci pencetus (keyword triggers), skrip jawapan rasmi, dan pilihan butang WhatsApp.</p>
    </section>

    <div class="actions">
      <button class="btn primary full" data-add-kb="1">
        ${icon('plus')} Tambah Keyword & Jawapan Baru
      </button>
    </div>

    <div class="search">
      ${icon('magnifying-glass')}
      <input id="kb-search" type="search" placeholder="Cari keyword atau soalan..." value="${e(state.q)}">
    </div>

    ${items.length ? items.map(k => `
      <div class="kb-card">
        <div class="kb-card-top">
          <span class="kb-keyword">${icon('key')} ${e(k.keyword)}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="lead-score-badge">+${n(k.scoreBoost)} Skor</span>
            <button class="icon-btn" data-edit-kb="${k.id}" aria-label="Sunting">${icon('pen')}</button>
            <button class="icon-btn" data-del-kb="${k.id}" aria-label="Padam" style="color:var(--red)">${icon('trash')}</button>
          </div>
        </div>
        <strong style="font-size:13px;display:block;margin-top:4px">${e(k.title)}</strong>
        <p class="kb-answer">${e(k.answer)}</p>
        ${k.buttons?.length ? `
          <div class="kb-buttons-row">
            ${k.buttons.map(b => `<span class="kb-btn-tag">${icon('hand-pointer')} ${e(b.text)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('') : empty('Pangkalan Pengetahuan Kosong', 'Klik "+ Tambah Keyword & Jawapan Baru" untuk menambah topik pertama.')}
  `;
}

function flowView() {
  const cfg = state.chatbotConfig || {
    botName: 'WhatsApp Smart Assistant',
    welcomeMessage: '',
    askNameMessage: '',
    askEmailMessage: '',
    qualificationIntro: '',
    qualificationQuestions: [],
    handoffMessage: '',
    handoffTelegramChatId: ''
  };

  const qs = cfg.qualificationQuestions || [];

  return `
    <section class="hero">
      <div class="kicker">Tetapan Interaksi</div>
      <h1>Alur Tapisan & Skrip Mesej</h1>
      <p>Ubah suai aliran perbualan bot daripada sambutan pertama hingga penyerahan kepada admin.</p>
    </section>

    <form id="flow-form" onsubmit="event.preventDefault()">
      <section class="card">
        <div class="card-head">
          <h2>${icon('id-card')} 1. Identiti & Sambutan Mesra</h2>
        </div>
        <div class="field-group">
          <label for="cfg-botName">Nama Pembantu Maya / Bisnes</label>
          <input id="cfg-botName" value="${e(cfg.botName)}">
        </div>
        <div class="field-group">
          <label for="cfg-welcome">Mesej Alu-aluan (Trigger Mesej Pertama)</label>
          <textarea id="cfg-welcome">${e(cfg.welcomeMessage)}</textarea>
          <div class="field-help">Dihantar sebaik sahaja pelanggan menghantar mesej kali pertama.</div>
        </div>
        <div class="field-group">
          <label for="cfg-askName">Mesej Meminta Nama</label>
          <textarea id="cfg-askName">${e(cfg.askNameMessage)}</textarea>
        </div>
        <div class="field-group">
          <label for="cfg-askEmail">Mesej Meminta Emel</label>
          <textarea id="cfg-askEmail">${e(cfg.askEmailMessage)}</textarea>
          <div class="field-help">Gunakan <code>{name}</code> untuk nama pelanggan.</div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>${icon('filter')} 2. Soalan Tapisan Minat (Qualification)</h2>
        </div>
        <div class="field-group">
          <label for="cfg-qualIntro">Mesej Pengenalan Tapisan</label>
          <textarea id="cfg-qualIntro">${e(cfg.qualificationIntro)}</textarea>
        </div>

        <div style="margin-top:14px">
          <strong>Soalan & Pilihan Butang Tapisan (${qs.length}):</strong>
          ${qs.map((q, idx) => `
            <div style="background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px">
              <strong style="font-size:12px;color:var(--deep)">Soalan ${idx + 1}:</strong>
              <div style="font-size:12px;margin:4px 0 8px">${e(q.question)}</div>
              <div class="kb-buttons-row">
                ${(q.options || []).map(o => `
                  <span class="kb-btn-tag" style="background:var(--surface)">
                    ${icon('circle-dot')} ${e(o.text)} (+${o.score}m)
                  </span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>${icon('paper-plane')} 3. Penyerahan Kepada Admin (Handoff)</h2>
        </div>
        <div class="field-group">
          <label for="cfg-handoff">Mesej Tamat Tapisan (Ke Pelanggan)</label>
          <textarea id="cfg-handoff">${e(cfg.handoffMessage)}</textarea>
        </div>
        <div class="field-group">
          <label for="cfg-teleChatId">Telegram Chat ID Admin (Pilihan)</label>
          <input id="cfg-teleChatId" placeholder="Kosongkan untuk guna Owner Bot sedia ada" value="${e(cfg.handoffTelegramChatId || '')}">
          <div class="field-help">Notifikasi prospek baru berserta link WhatsApp akan dihantar ke ID Telegram ini.</div>
        </div>
      </section>

      <div class="actions">
        <button class="btn primary full" data-save-flow="1">
          ${icon('check')} Simpan Semua Tetapan Alur
        </button>
      </div>
    </form>
  `;
}

function simulatorView() {
  const messages = state.simMessages || [];

  return `
    <section class="hero">
      <div class="kicker">Ujian Maya Pantas</div>
      <h1>Simulator WhatsApp Chat</h1>
      <p>Uji aliran sapaan, kutipan nama/emel, soalan tapisan & butang interaktif secara langsung.</p>
    </section>

    <div class="actions">
      <button class="btn danger full" data-sim-reset="1">
        ${icon('rotate-left')} Mula Semula Sesi Simulasi (Reset)
      </button>
    </div>

    <div class="chat-phone">
      <div class="chat-phone-header">
        <img src="assets/logo.png" alt="Bot">
        <div class="chat-phone-title">
          <strong>${e(state.chatbotConfig?.botName || 'WhatsApp Smart Bot')}</strong>
          <small><span class="dot" style="color:#00a884"></span> dalam talian (online)</small>
        </div>
      </div>

      <div class="chat-messages" id="sim-chat-box">
        ${messages.map(m => `
          <div class="chat-bubble ${m.direction === 'INBOUND' ? 'user' : 'bot'}">
            ${e(m.content).replace(/\n/g, '<br>')}
            ${m.buttons?.length ? `
              <div class="chat-buttons-container">
                ${m.buttons.map(b => `
                  <button class="chat-btn-action" data-sim-btn="${e(b.id || b.text)}">
                    ${icon('hand-pointer')} ${e(b.text)}
                  </button>
                `).join('')}
              </div>
            ` : ''}
            <div class="chat-bubble-time">${m.time || 'Baru sahaja'}</div>
          </div>
        `).join('')}
        ${state.simLoading ? `
          <div class="chat-bubble bot">
            <i class="fa-solid fa-ellipsis fa-fade"></i> Sedang menaip...
          </div>
        ` : ''}
      </div>

      <div class="chat-input-bar">
        <input id="sim-input" type="text" placeholder="Taip mesej WhatsApp anda..." onkeydown="if(event.key==='Enter')document.getElementById('sim-send-btn').click()">
        <button id="sim-send-btn" data-sim-send="1" aria-label="Hantar">${icon('paper-plane')}</button>
      </div>
    </div>
  `;
}

function more() {
  if (state.morePage) return moreDetail();
  return `
    <section class="hero">
      <div class="kicker">Pusat Kawalan Lanjutan</div>
      <h1>Pengurusan & Sistem</h1>
      <p>Tetapan alur bot, akaun WhatsApp, kumpulan, dan status sistem.</p>
    </section>
    <section class="card">
      ${link('Alur Tapisan & Skrip Mesej', 'Ubah suai soalan tapisan & handoff', 'sliders', 'nav', 'flow')}
      ${link('Akaun WhatsApp', 'Sambungan & nombor WhatsApp aktif', 'mobile-screen-button', 'more', 'accounts')}
      ${link('Kempen Auto Post & Join', 'Modul promosi group asal', 'bullhorn', 'more', 'campaigns')}
      ${link('Group Tersimpan', 'Semak akses group mengikut akaun', 'users', 'more', 'groups')}
      ${link('Sistem & Storage', 'Penggunaan pangkalan data & versi', 'server', 'more', 'system')}
      ${link('Panduan Penggunaan', 'Cara guna bot & pangkalan pengetahuan', 'circle-question', 'more', 'help')}
    </section>
    <button class="btn full" data-bot=".menu">${icon('robot')} Kembali ke Telegram Bot</button>
  `;
}

function moreDetail() {
  const r = state.moreData || { items: [] }, kind = state.morePage;
  let content = '';

  if (kind === 'campaigns') {
    content = `
      <p style="font-size:12px;margin-bottom:14px">Modul kempen auto post, join group dan follow-up sedia ada dikekalkan sepenuhnya:</p>
      <div class="actions">
        <button class="btn" data-bot=".mula">${icon('play')} Mula Kempen Post</button>
        <button class="btn" data-bot=".join">${icon('link')} Auto Join Group</button>
      </div>
    `;
  }
  if (kind === 'accounts') content = `<section class="card">${r.items.map(a => accountRow(a)).join('') || '<p>Belum ada akaun.</p>'}</section><button class="btn full" data-bot=".accounts">${icon('mobile-screen-button')} Urus akaun di bot</button>`;
  if (kind === 'groups') content = `<div class="search">${icon('magnifying-glass')}<input id="group-search" type="search" placeholder="Cari group…" aria-label="Cari group" value="${e(state.q)}"></div><select id="group-account" aria-label="Tapis group mengikut akaun"><option value="">Semua akaun</option>${(state.overview?.accounts || []).map(a => `<option value="${a.id}" ${String(a.id) === state.account ? 'selected' : ''}>Akaun ${e(a.number)} · …${e(a.phone)}</option>`).join('')}</select><section class="card">${r.items.map(g => `<div class="account-row"><span class="icon-tile">${icon('users')}</span><div class="account-info"><strong>${e(g.name)}</strong><small>Akaun ${e(g.accountId)} · ${n(g.members)} ahli</small></div></div>`).join('') || '<p class="note">Tiada group dijumpai.</p>'}</section>${pager(r.page, r.pages)}`;
  if (kind === 'system') content = `<section class="card"><div class="card-head"><h2>${icon('sliders')} Status Sistem</h2>${pill('ONLINE', 'Controller')}</div><dl><dt>Versi</dt><dd>Build ${e(r.build || 214)}</dd><dt>Modul Chatbot</dt><dd>Pintar & Tapisan Aktif</dd><dt>Storage projek</dt><dd>${bytes(r.bytes || 400000000)}</dd></dl></section>`;
  if (kind === 'help') content = `<section class="card"><h2>Panduan WhatsApp Smart Chatbot</h2><div class="sheet-copy">1. <b>Auto Trigger</b>: Apabila mana-mana nombor WhatsApp pelanggan menghantar mesej pertama, bot terus menyambut dan meminta nama & emel.
2. <b>Soalan Tapisan (Qualification)</b>: Bot bertanya 2-3 soalan pilihan untuk mengetahui bajet, keperluan, dan tempoh pembelian.
3. <b>Butang Interaktif</b>: Pelanggan boleh menekan butang jawapan secara terus di WhatsApp, atau menaip nombor pilihan (1, 2, 3).
4. <b>Pangkalan Pengetahuan (Knowledge Base)</b>: Bila pelanggan bertanya tentang harga, pakej, lokasi, atau produk, bot memadankan kata kunci dan menjawab dengan skrip rasmi.
5. <b>Notifikasi Telegram (Handoff)</b>: Sebaik sahaja prospek selesai menjawab soalan tapisan atau memilih minat membeli, notifikasi segera dihantar ke Telegram Admin berserta pautan terus ke chat WhatsApp pelanggan.</div></section>`;

  return `<div class="section-label"><button class="text-btn" data-more="">${icon('arrow-left')} Kembali ke Menu</button></div>${content}`;
}

function bytes(v) { return Number(v) >= 1e9 ? (v / 1e9).toFixed(2) + ' GB' : (Number(v || 0) / 1e6).toFixed(1) + ' MB'; }

function render() {
  const active = document.activeElement;
  const focus = active?.matches('input,select,textarea') && view.contains(active) ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;

  if (state.tab === 'home') view.innerHTML = home();
  else if (state.tab === 'leads') view.innerHTML = leadsView();
  else if (state.tab === 'kb') view.innerHTML = kbView();
  else if (state.tab === 'flow') view.innerHTML = flowView();
  else if (state.tab === 'simulator') view.innerHTML = simulatorView();
  else if (state.tab === 'more') view.innerHTML = more();

  if (focus) {
    const input = document.getElementById(focus.id);
    input?.focus({ preventScroll: true });
    if (input && focus.start != null) try { input.setSelectionRange(focus.start, focus.end); } catch { }
  }

  // Scroll simulator to bottom if simulator active
  if (state.tab === 'simulator') {
    const box = document.getElementById('sim-chat-box');
    if (box) box.scrollTop = box.scrollHeight;
  }

  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === state.tab));
}

async function refresh() {
  if (busy) { refreshQueued = true; return; }
  if (actionBusy || document.hidden || authFailed) return;
  busy = true;
  const version = generation;

  try {
    // Fetch Chatbot Overview
    if (!state.chatbotOverview || state.tab === 'home' || Date.now() - overviewFetched > 15000) {
      try {
        state.chatbotOverview = await api('chatbot/overview');
        overviewFetched = Date.now();
      } catch {
        // Fallback to general overview if chatbot endpoint in migration
      }
    }

    if (state.tab === 'leads') {
      const res = await api('chatbot/leads', { status: state.status, q: state.q, page: state.chatbotLeadPage });
      if (version !== generation) return;
      state.chatbotLeads = res.items || [];
      state.chatbotLeadTotal = res.total || 0;
    } else if (state.tab === 'kb') {
      const res = await api('chatbot/knowledge', { q: state.q });
      if (version !== generation) return;
      state.chatbotKb = res.items || [];
    } else if (state.tab === 'flow') {
      const res = await api('chatbot/config');
      if (version !== generation) return;
      state.chatbotConfig = res;
    } else if (state.tab === 'simulator' && !state.simMessages.length) {
      const res = await api('chatbot/simulate', {}, { reset: true });
      if (version !== generation) return;
      state.simMessages = res.messages || [];
      state.simStep = res.step;
    } else if (state.tab === 'more' && state.morePage) {
      const path = { system: 'health', accounts: 'accounts', groups: 'groups', clients: 'clients' }[state.morePage];
      if (path) {
        const data = await api(path, { page: state.page, q: state.q });
        if (version !== generation) return;
        state.moreData = data;
      }
    }

    if (version !== generation) return;
    lastAt = new Date().toISOString();
    setConnected(true);
    render();
  } catch (err) {
    if (version !== generation) return;
    setConnected(false, err.message || 'Mencuba semula…');
    render();
  } finally {
    busy = false;
    if (refreshQueued) {
      refreshQueued = false;
      queueMicrotask(refresh);
    }
  }
}

function navigate(tab) {
  generation++;
  state = {
    ...state,
    tab,
    morePage: '',
    q: '',
    status: '',
    editingKb: null
  };
  authFailed = false;
  view.innerHTML = empty('Memuatkan', 'Mendapatkan data terkini...');
  window.scrollTo({ top: 0 });
  refresh();
}

function sheet(title, html) {
  $('#sheet-body').innerHTML = `<h2 id="sheet-title" class="sheet-title">${e(title)}</h2>${html}`;
  $('#sheet').showModal();
}

/* ==================== SIMULATOR HANDLER ==================== */

async function sendSimulatorMessage(text) {
  if (!text.trim()) return;
  state.simLoading = true;
  render();

  try {
    const res = await api('chatbot/simulate', {}, { text });
    state.simMessages = res.messages || [];
    state.simStep = res.step;
    if (res.lead?.status === 'QUALIFIED') {
      toast('🔥 Tahniah! Alert Prospek Layak telah dihantar ke Telegram Admin!');
    }
  } catch (err) {
    toast('Ralat: ' + err.message);
  } finally {
    state.simLoading = false;
    render();
  }
}

/* ==================== EVENT LISTENER ==================== */

document.addEventListener('click', async ev => {
  const b = ev.target.closest('button');
  const a = ev.target.closest('a');
  if (a && a.target === '_blank') return; // Allow normal links
  if (!b || b.disabled) return;
  const d = b.dataset;

  if (d.nav) navigate(d.nav);

  // Toggle Bot Status
  if ('toggleBot' in d) {
    try {
      const enabled = d.toggleBot === '1';
      await api('chatbot/config', {}, { enabled });
      toast(enabled ? 'Chatbot kini Diaktifkan.' : 'Chatbot Dijeda.');
      refresh();
    } catch (err) {
      toast(err.message);
    }
  }

  // Leads Filter
  if ('leadFilter' in d) {
    state.status = d.leadFilter;
    refresh();
  }

  // Lead Details Modal
  if (d.leadDetail) {
    const lead = (state.chatbotLeads || []).find(l => l.phone === d.leadDetail) ||
      (state.chatbotOverview?.recentLeads || []).find(l => l.phone === d.leadDetail);
    if (lead) {
      const answers = lead.qualificationAnswers || {};
      const answerRows = Object.entries(answers).map(([k, v]) => `
        <dt>${e(v.question || k)}</dt>
        <dd><b>${e(v.selectedText || v.answer || v)}</b></dd>
      `).join('');

      sheet(`Prospek: ${lead.name || 'Pelanggan'}`, `
        <dl>
          <dt>Nombor Telefon</dt>
          <dd>+${e(lead.phone)}</dd>
          <dt>Alamat Emel</dt>
          <dd>${e(lead.email || '—')}</dd>
          <dt>Status Tapisan</dt>
          <dd>${pill(lead.status)}</dd>
          <dt>Skor Minat</dt>
          <dd><b>${n(lead.qualificationScore)} / 100</b></dd>
          ${answerRows}
          <dt>Tarikh Mula</dt>
          <dd>${date(lead.createdAt)}</dd>
        </dl>
        <div class="actions">
          <a href="https://wa.me/${e(lead.phone)}" target="_blank" class="btn-wa-direct full" style="justify-content:center">
            <i class="fa-brands fa-whatsapp"></i> Teruskan Perbualan WhatsApp
          </a>
        </div>
      `);
    }
  }

  // Export Leads to CSV
  if (d.exportLeads) {
    const leads = state.chatbotLeads || [];
    if (!leads.length) return toast('Tiada prospek untuk dieksport.');
    const quote = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const csv = '\uFEFF' + [
      ['ID', 'Nama', 'Telefon', 'Emel', 'Status', 'Skor', 'Masa Terakhir', 'Nota'],
      ...leads.map(l => [l.id, l.name, l.phone, l.email, l.status, l.qualificationScore, date(l.lastInteractionAt), l.notes])
    ].map(r => r.map(quote).join(',')).join('\r\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const dl = document.createElement('a');
    dl.href = url;
    dl.download = 'WhatsApp-Prospek-' + new Date().toISOString().slice(0, 10) + '.csv';
    dl.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Senarai prospek CSV dimuat turun.');
  }

  // Add Knowledge Base Modal
  if (d.addKb) {
    sheet('Tambah Keyword & Jawapan Baru', `
      <form id="kb-form" onsubmit="event.preventDefault()">
        <div class="field-group">
          <label>Kata Kunci / Keyword (cth: harga, pakej, diskaun)</label>
          <input id="kb-new-kw" required placeholder="harga, kos, fee">
        </div>
        <div class="field-group">
          <label>Tajuk Ringkas</label>
          <input id="kb-new-title" required placeholder="Maklumat Harga & Pakej">
        </div>
        <div class="field-group">
          <label>Skrip Jawapan Bot</label>
          <textarea id="kb-new-answer" required placeholder="Tulis jawapan lengkap yang akan dihantar kepada pelanggan..."></textarea>
        </div>
        <div class="field-group">
          <label>Pilihan Butang Interaktif (Asingkan dengan koma)</label>
          <input id="kb-new-btns" placeholder="Pakej Basic, Pakej Pro, Hubungi Admin">
          <div class="field-help">Butang ini boleh ditekan oleh pelanggan terus di WhatsApp.</div>
        </div>
        <div class="field-group">
          <label>Skor Minat (Boost)</label>
          <input id="kb-new-score" type="number" value="15" min="0" max="50">
        </div>
        <div class="actions">
          <button class="btn primary full" data-save-new-kb="1">${icon('check')} Simpan Pangkalan Pengetahuan</button>
        </div>
      </form>
    `);
  }

  // Save New Knowledge Base
  if (d.saveNewKb) {
    const keyword = $('#kb-new-kw')?.value?.trim();
    const title = $('#kb-new-title')?.value?.trim() || keyword;
    const answer = $('#kb-new-answer')?.value?.trim();
    const btnsRaw = $('#kb-new-btns')?.value?.trim() || '';
    const scoreBoost = Number($('#kb-new-score')?.value) || 15;

    if (!keyword || !answer) return toast('Sila lengkapkan keyword dan jawapan.');

    const buttons = btnsRaw ? btnsRaw.split(',').map(b => b.trim()).filter(Boolean).map(text => ({
      id: 'btn_' + text.toLowerCase().replace(/\s+/g, '_'),
      text
    })) : [];

    try {
      await api('chatbot/knowledge', {}, { keyword, title, answer, buttons, scoreBoost });
      $('#sheet').close();
      toast('Keyword & jawapan berjaya ditambah.');
      refresh();
    } catch (err) {
      toast(err.message);
    }
  }

  // Delete Knowledge Base
  if (d.delKb) {
    if (confirm('Padam keyword ini daripada pangkalan pengetahuan?')) {
      try {
        await api('chatbot/knowledge/delete', {}, { id: Number(d.delKb) });
        toast('Keyword dipadam.');
        refresh();
      } catch (err) {
        toast(err.message);
      }
    }
  }

  // Save Flow Configuration
  if (d.saveFlow) {
    const botName = $('#cfg-botName')?.value?.trim();
    const welcomeMessage = $('#cfg-welcome')?.value?.trim();
    const askNameMessage = $('#cfg-askName')?.value?.trim();
    const askEmailMessage = $('#cfg-askEmail')?.value?.trim();
    const qualificationIntro = $('#cfg-qualIntro')?.value?.trim();
    const handoffMessage = $('#cfg-handoff')?.value?.trim();
    const handoffTelegramChatId = $('#cfg-teleChatId')?.value?.trim();

    try {
      await api('chatbot/config', {}, {
        botName,
        welcomeMessage,
        askNameMessage,
        askEmailMessage,
        qualificationIntro,
        handoffMessage,
        handoffTelegramChatId
      });
      toast('Tetapan alur chatbot berjaya disimpan.');
      refresh();
    } catch (err) {
      toast(err.message);
    }
  }

  // Simulator Actions
  if (d.simReset) {
    await api('chatbot/simulate', {}, { reset: true });
    toast('Sesi simulasi telah dimulakan semula.');
    refresh();
  }

  if (d.simSend) {
    const input = $('#sim-input');
    const text = input?.value || '';
    if (text.trim()) {
      input.value = '';
      sendSimulatorMessage(text);
    }
  }

  if (d.simBtn) {
    sendSimulatorMessage(d.simBtn);
  }

  // More Navigation
  if ('more' in d) {
    state.morePage = d.more;
    render();
  }

  if (d.closeSheet) {
    $('#sheet').close();
  }
});

// Search inputs live filter
document.addEventListener('input', ev => {
  if (ev.target.id === 'lead-search') {
    state.q = ev.target.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(refresh, 350);
  }
  if (ev.target.id === 'kb-search') {
    state.q = ev.target.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(refresh, 350);
  }
});

$('#close-sheet')?.addEventListener('click', () => $('#sheet').close());
$('#theme')?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  try {
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  } catch { }
});

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

// Initial boot
refresh();
setInterval(refresh, 8000);
