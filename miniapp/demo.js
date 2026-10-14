// Explicit design preview & interactive chatbot demo simulation.
const accounts=[{id:1,number:1,phone:'60123455678',status:'ONLINE',groups:120,processed:17,total:34,success:15,inFlight:1},{id:2,number:2,phone:'60198769012',status:'ONLINE',groups:85,processed:15,total:33,waitKind:'REST',waitUntil:new Date(Date.now()+260000).toISOString(),success:12},{id:3,number:3,phone:'60172343456',status:'ONLINE',groups:59,processed:10,total:33,waitKind:'DELAY',waitUntil:new Date(Date.now()+45000).toISOString(),success:8}];
let jobs=[{key:'join:1',kind:'join',id:1,name:'Join Group Bisnes',status:'RUNNING',actions:['pause','stop'],mode:'ONCE',success:35,failed:5,already:2,unknown:0,approval:0,processed:42,total:100,inFlight:1,pending:57,accounts,startedAt:new Date().toISOString()},{key:'post:1',kind:'post',id:1,name:'Promosi Hujung Minggu',client:'Ahmad Printing',clientId:7,ownerType:'CLIENT',status:'PAUSED',actions:['resume','stop'],mode:'SUCCESS',success:75,failed:3,unknown:1,processed:79,total:100,inFlight:0,accounts,startedAt:new Date().toISOString()},{key:'gs:1',kind:'gs',id:1,name:'Status Group 1',preview:'Promosi istimewa minggu ini.',status:'COMPLETED',actions:[],deletion:{allowed:true,pending:0},mode:'ONCE',success:80,failed:3,unknown:2,skipped:0,processed:85,total:85,pending:0,inFlight:0,accounts:accounts.map((a,i)=>({...a,total:[28,29,28][i],processed:[28,29,28][i],success:[27,28,25][i],inFlight:0,waitUntil:null})),notice:'ACK OK bukan bukti Status dipaparkan.',startedAt:new Date().toISOString(),completedAt:new Date().toISOString()}];
const names=['Bisnes Kedah','Komuniti Utara','Peniaga Online Malaysia','Usahawan Pulau Pinang','Promosi Produk & Servis','Komuniti Seberang Perai','Niaga Santai','Sahabat Bisnes','Jual Beli Malaysia','Digital Marketing'];
let nonce='';

let demoLeads = [
  {
    id: 1, phone: '60123456789', name: 'Zulkifli Hassan', email: 'zul.hassan@biz.com',
    status: 'QUALIFIED', qualificationScore: 90,
    qualificationAnswers: {
      q_service: { question: 'Apakah pakej atau servis yang menarik perhatian anda?', selectedText: 'Pakej Premium / Bisnes' },
      q_budget: { question: 'Apakah anggaran bajet peruntukan yang anda sediakan?', selectedText: 'Lebih RM1,500 (VIP)' },
      q_timeline: { question: 'Bila anda bercadang untuk bermula atau membuat pembelian?', selectedText: 'Segera (Minggu ini)' }
    },
    notes: 'Hot Lead! Berminat bayar segera.',
    lastInteractionAt: new Date().toISOString(), createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2, phone: '60198765432', name: 'Nurul Ain', email: 'ain@creative.my',
    status: 'HANDOFF', qualificationScore: 75,
    qualificationAnswers: {
      q_service: { question: 'Apakah pakej atau servis yang menarik perhatian anda?', selectedText: 'Pakej Standard' },
      q_budget: { question: 'Apakah anggaran bajet peruntukan yang anda sediakan?', selectedText: 'RM500 - RM1,500' },
      q_timeline: { question: 'Bila anda bercadang untuk bermula atau membuat pembelian?', selectedText: 'Segera (Minggu ini)' }
    },
    notes: 'Menunggu jawapan soalan invois daripada admin.',
    lastInteractionAt: new Date(Date.now() - 7200000).toISOString(), createdAt: new Date(Date.now() - 14400000).toISOString()
  },
  {
    id: 3, phone: '60172348901', name: 'Danial Firdaus', email: 'danial@gmail.com',
    status: 'NEW', qualificationScore: 20,
    qualificationAnswers: {},
    notes: 'Baru mula bersembang.',
    lastInteractionAt: new Date(Date.now() - 18000000).toISOString(), createdAt: new Date(Date.now() - 18000000).toISOString()
  }
];

let demoKnowledge = [
  {
    id: 1,
    keyword: 'harga',
    title: 'Harga & Pakej',
    answer: 'Pakej kami bermula serendah RM150 untuk Pakej Asas sehingga RM850 untuk Pakej Lengkap Unlimited. Sila tekan butang di bawah untuk semak butiran atau terus bercakap dengan pegawai kami.',
    buttons: [
      { id: 'btn_pakej', text: 'Lihat Senarai Pakej' },
      { id: 'btn_promo', text: 'Tawaran Diskaun' },
      { id: 'btn_admin', text: 'Hubungi Pegawai' }
    ],
    scoreBoost: 20,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    keyword: 'pakej',
    title: 'Pilihan Pakej Tersedia',
    answer: 'Kami menawarkan 3 pilihan pakej utama: 1) Pakej Starter untuk individu, 2) Pakej Pro untuk perniagaan kecil, 3) Pakej Enterprise untuk syarikat dengan sokongan dedicated.',
    buttons: [
      { id: 'btn_beli', text: 'Berminat Membeli' },
      { id: 'btn_admin', text: 'Bercakap Dengan Admin' }
    ],
    scoreBoost: 20,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    keyword: 'lokasi',
    title: 'Lokasi & Waktu Operasi',
    answer: 'Ibu pejabat kami beroperasi secara atas talian sepenuhnya di Malaysia. Pasukan sokongan kami bertugas setiap hari dari jam 9:00 pagi hingga 10:00 malam.',
    buttons: [
      { id: 'btn_soalan', text: 'Tanya Soalan Lain' },
      { id: 'btn_admin', text: 'Cakap Dengan Admin' }
    ],
    scoreBoost: 5,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 4,
    keyword: 'beli',
    title: 'Tempahan & Pembelian',
    answer: 'Hebat! Kami sangat berbesar hati untuk membantu pembelian anda. Sila sahkan butiran anda dan pegawai jualan kami akan terus berkongsi link invois/pembayaran.',
    buttons: [
      { id: 'btn_admin', text: 'Teruskan Pembelian' }
    ],
    scoreBoost: 40,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

let demoConfig = {
  enabled: true,
  botName: 'WhatsApp Smart Assistant',
  welcomeMessage: 'Hai! Terima kasih kerana menghubungi kami. Saya adalah pembantu maya automatik anda. 😊',
  askNameMessage: 'Boleh kami tahu nama penuh atau panggilan anda terlebih dahulu?',
  askEmailMessage: 'Terima kasih {name}! Sila kongsikan alamat emel anda untuk kami hantarkan maklumat tawaran & resit.',
  qualificationIntro: 'Terima kasih {name}! Bagi membolehkan kami memberikan cadangan pakej yang paling tepat, izinkan saya bertanyakan beberapa soalan ringkas.',
  qualificationQuestions: [
    {
      id: 'q_service',
      question: 'Apakah pakej atau servis yang menarik perhatian anda?',
      options: [
        { id: 'opt_pkg_standard', text: 'Pakej Standard', score: 15, isBuyingSignal: false },
        { id: 'opt_pkg_premium', text: 'Pakej Premium / Bisnes', score: 30, isBuyingSignal: true },
        { id: 'opt_pkg_custom', text: 'Rundingan Khusus', score: 25, isBuyingSignal: true }
      ]
    },
    {
      id: 'q_budget',
      question: 'Apakah anggaran bajet peruntukan yang anda sediakan?',
      options: [
        { id: 'opt_bgt_low', text: 'Bawah RM500', score: 10, isBuyingSignal: false },
        { id: 'opt_bgt_mid', text: 'RM500 - RM1,500', score: 25, isBuyingSignal: true },
        { id: 'opt_bgt_high', text: 'Lebih RM1,500 (VIP)', score: 35, isBuyingSignal: true }
      ]
    },
    {
      id: 'q_timeline',
      question: 'Bila anda bercadang untuk bermula atau membuat pembelian?',
      options: [
        { id: 'opt_time_urgent', text: 'Segera (Minggu ini)', score: 35, isBuyingSignal: true },
        { id: 'opt_time_month', text: 'Bulan ini', score: 20, isBuyingSignal: false },
        { id: 'opt_time_survey', text: 'Sekadar tinjau harga', score: 5, isBuyingSignal: false }
      ]
    }
  ],
  handoffMessage: 'Terima kasih {name}! Maklumat anda telah disahkan dan kami telah maklumkan kepada Pegawai Jualan kami. Pegawai kami akan mengambil alih perbualan ini sebentar sahaja lagi untuk membantu anda. Sila tunggu sebentar ya!',
  handoffTelegramChatId: '',
  updatedAt: new Date().toISOString()
};

let simState = {
  step: 'START',
  name: '',
  email: '',
  qIndex: 0,
  answers: {},
  messages: [
    { id: 1, direction: 'OUTBOUND', content: `${demoConfig.welcomeMessage}\n\n${demoConfig.askNameMessage}`, buttons: [], time: 'Baru saja' }
  ]
};

export async function demoApi(path, p = {}, body) {
  // Chatbot Endpoints in Demo Mode
  if (path === 'chatbot/overview') {
    return {
      config: { enabled: demoConfig.enabled, botName: demoConfig.botName, updatedAt: demoConfig.updatedAt },
      stats: {
        totalLeads: demoLeads.length,
        qualifiedLeads: demoLeads.filter(l => l.status === 'QUALIFIED' || l.status === 'HANDOFF').length,
        newLeads: demoLeads.filter(l => l.status === 'NEW').length,
        totalKb: demoKnowledge.filter(k => k.isActive).length,
        totalMessages: 24
      },
      recentLeads: demoLeads,
      onlineAccounts: accounts.filter(a => a.status === 'ONLINE')
    };
  }

  if (path === 'chatbot/config') {
    if (body) {
      demoConfig = { ...demoConfig, ...body, updatedAt: new Date().toISOString() };
      return { success: true, config: demoConfig };
    }
    return demoConfig;
  }

  if (path === 'chatbot/knowledge') {
    if (body) {
      const newItem = {
        id: demoKnowledge.length + 1,
        keyword: String(body.keyword || '').toLowerCase(),
        title: body.title || body.keyword,
        answer: body.answer,
        buttons: Array.isArray(body.buttons) ? body.buttons : [],
        scoreBoost: Number(body.scoreBoost || 15),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      demoKnowledge.unshift(newItem);
      return { success: true, item: newItem };
    }
    let items = demoKnowledge;
    if (p.q) {
      const q = p.q.toLowerCase();
      items = items.filter(k => k.keyword.includes(q) || k.title.toLowerCase().includes(q) || k.answer.toLowerCase().includes(q));
    }
    return { items };
  }

  if (path === 'chatbot/knowledge/update') {
    const item = demoKnowledge.find(k => k.id === Number(body.id));
    if (item) {
      Object.assign(item, body, { updatedAt: new Date().toISOString() });
    }
    return { success: true, item };
  }

  if (path === 'chatbot/knowledge/delete') {
    demoKnowledge = demoKnowledge.filter(k => k.id !== Number(body.id));
    return { success: true };
  }

  if (path === 'chatbot/leads') {
    let items = demoLeads;
    if (p.status) items = items.filter(l => l.status === p.status);
    if (p.q) {
      const q = p.q.toLowerCase();
      items = items.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.email.toLowerCase().includes(q));
    }
    return { items, total: items.length, page: 1, limit: 20 };
  }

  if (path === 'chatbot/leads/update') {
    const lead = demoLeads.find(l => l.phone === body.phone);
    if (lead) Object.assign(lead, body);
    return { success: true, lead };
  }

  if (path === 'chatbot/simulate') {
    const text = String(body.text || '').trim();
    if (body.reset) {
      simState = {
        step: 'START',
        name: '',
        email: '',
        qIndex: 0,
        answers: {},
        messages: [
          { id: 1, direction: 'OUTBOUND', content: `${demoConfig.welcomeMessage}\n\n${demoConfig.askNameMessage}`, buttons: [], time: 'Baru saja' }
        ]
      };
      return {
        messages: simState.messages,
        step: simState.step,
        lead: null
      };
    }

    // Add user message
    simState.messages.push({
      id: simState.messages.length + 1,
      direction: 'INBOUND',
      content: text,
      buttons: [],
      time: 'Baru saja'
    });

    let botReplyText = '';
    let botButtons = [];

    if (simState.step === 'START') {
      simState.name = text.replace(/^(saya\s+|nama\s+saya\s+|i\s+am\s+)/i, '');
      simState.step = 'AWAIT_EMAIL';
      botReplyText = demoConfig.askEmailMessage.replace(/\{name\}/g, simState.name);
      botButtons = [{ id: 'btn_skip_email', text: 'Tiada Emel / Langkau' }];
    } else if (simState.step === 'AWAIT_EMAIL') {
      simState.email = text.includes('@') ? text : 'tiada@emel.com';
      simState.step = 'QUALIFYING';
      simState.qIndex = 0;
      const q = demoConfig.qualificationQuestions[0];
      botReplyText = `${demoConfig.qualificationIntro.replace(/\{name\}/g, simState.name)}\n\n*Soalan 1/${demoConfig.qualificationQuestions.length}:*\n${q.question}`;
      botButtons = q.options.map(o => ({ id: o.id, text: o.text }));
    } else if (simState.step === 'QUALIFYING') {
      const q = demoConfig.qualificationQuestions[simState.qIndex];
      simState.answers[q.id] = text;
      simState.qIndex++;

      if (simState.qIndex < demoConfig.qualificationQuestions.length) {
        const nextQ = demoConfig.qualificationQuestions[simState.qIndex];
        botReplyText = `👍 *Soalan ${simState.qIndex + 1}/${demoConfig.qualificationQuestions.length}:*\n${nextQ.question}`;
        botButtons = nextQ.options.map(o => ({ id: o.id, text: o.text }));
      } else {
        simState.step = 'HANDOFF';
        botReplyText = `🔥 *[TELEGRAM ALERT DIHANTAR KE ADMIN]*\n\n${demoConfig.handoffMessage.replace(/\{name\}/g, simState.name)}`;
        botButtons = [
          { id: 'btn_pakej', text: 'Pakej & Harga' },
          { id: 'btn_reset', text: 'Mula Semula' }
        ];

        // Add to leads
        demoLeads.unshift({
          id: demoLeads.length + 1,
          phone: '60123456789',
          name: simState.name || 'Prospek Ujian',
          email: simState.email || 'ujian@gmail.com',
          status: 'QUALIFIED',
          qualificationScore: 85,
          qualificationAnswers: simState.answers,
          notes: 'Dihasilkan daripada sesi simulasi portal admin',
          lastInteractionAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
    } else {
      // Knowledge base or handoff state
      const kbMatch = demoKnowledge.find(k => text.toLowerCase().includes(k.keyword) || text.toLowerCase() === k.title.toLowerCase());
      if (kbMatch) {
        botReplyText = kbMatch.answer;
        botButtons = kbMatch.buttons;
      } else {
        botReplyText = `Mesej anda telah diterima. Pegawai kami sedang bersiap sedia untuk membantu anda secara terus. Terima kasih!`;
        botButtons = [
          { id: 'btn_reset', text: 'Mula Semula' },
          { id: 'btn_pakej', text: 'Pakej & Harga' }
        ];
      }
    }

    simState.messages.push({
      id: simState.messages.length + 1,
      direction: 'OUTBOUND',
      content: botReplyText,
      buttons: botButtons,
      time: 'Baru saja'
    });

    return {
      messages: simState.messages,
      step: simState.step,
      lead: {
        name: simState.name,
        email: simState.email,
        status: simState.step === 'HANDOFF' ? 'QUALIFIED' : 'NEW'
      }
    };
  }

  // Core WhatsApp Bot & Campaing Endpoints
  if (path === 'overview') return { build: 214, user: { name: 'Admin' }, at: new Date().toISOString(), accounts, groups: { uniqueCount: 263, accessCount: 264 }, running: jobs.filter(j => j.status === 'RUNNING').length, active: jobs.filter(j => ['RUNNING', 'PAUSED'].includes(j.status)).length, records: jobs.filter(j => ['STOPPED', 'COMPLETED'].includes(j.status)).length };
  if (path === 'jobs') { const items = jobs.filter(j => (p.scope === 'records' ? ['STOPPED', 'COMPLETED'] : ['RUNNING', 'PAUSED']).includes(j.status) && (p.kind === 'all' || !p.kind || j.kind === p.kind) && (!p.client || String(j.clientId) === p.client) && (p.owner === 'all' || !p.owner || (p.owner === 'client' ? j.client : !j.client))); return { items, total: items.length, page: 1, pages: 1 }; }
  if (path === 'job') return structuredClone(jobs.find(j => j.key === p.key));
  if (path === 'results') { const j = jobs.find(j => j.key === p.key); let rows = names.map((name, i) => ({ id: 10 - i, groupName: name, accountId: i % 3 + 1, status: i === 1 ? 'FAILED' : i === 3 ? (j.kind === 'join' ? 'ALREADY' : 'UNKNOWN') : j.kind === 'gs' ? 'ACCEPTED' : 'SUCCESS', at: new Date(Date.now() - i * 51000).toISOString(), error: i === 1 ? 'Permintaan ditolak dalam data contoh.' : '' })); rows = rows.filter(r => (!p.account || String(r.accountId) === p.account) && (!p.q || r.groupName.toLowerCase().includes(p.q.toLowerCase())) && (!p.status || r.status === p.status)); return { items: rows, total: rows.length, page: 1, pages: 1 }; }
  if (path === 'confirm') { const j = jobs.find(j => j.key === body.key); nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join(''); return { ...j, nonce }; }
  if (path === 'action') { const j = jobs.find(j => j.key === body.key); if (j.status !== body.expectedStatus) throw Error('Keadaan job sudah berubah.'); if (['stop', 'delete'].includes(body.action) && body.confirmation !== nonce) throw Error('Pengesahan tidak sah.'); if (body.action === 'delete') { jobs = jobs.filter(x => x.key !== body.key); return { ok: true, deleted: true, key: body.key }; } j.deletion = body.action === 'stop' ? { allowed: true, pending: j.pending || 0 } : null; j.status = { pause: 'PAUSED', resume: 'RUNNING', stop: 'STOPPED' }[body.action]; j.actions = j.status === 'RUNNING' ? ['pause', 'stop'] : j.status === 'PAUSED' ? ['resume', 'stop'] : j.kind === 'post' ? [] : ['resume']; return { ok: true, job: structuredClone(j) }; }
  if (path === 'accounts') return { items: accounts };
  if (path === 'sync') return { items: [{ key: 'sync:1', kind: 'sync', id: 1, name: 'Sync · Akaun 1', status: 'COMPLETED', processed: 120, total: 120, accounts: [accounts[0]], actions: [] }], page: 1, pages: 1, total: 1 };
  if (path === 'groups') return { items: names.filter(x => !p.q || x.toLowerCase().includes(p.q.toLowerCase())).map((name, i) => ({ id: i + 1, name, members: 530 + i * 40, accountId: 1 })), total: 10, page: 1, pages: 1 };
  if (path === 'clients') return { items: [{ id: 7, name: 'Ahmad Printing', package: 'Kempen Percubaan' }], page: 1, pages: 1, total: 1 };
  if (path === 'health') return { build: 214, controller: 'ONLINE', bytes: 420e6, free: 8.4e9, categories: { media: 180e6, sessions: 80e6, database: 35e6, code: 120e6, logs: 4e6, temp: 1e6 } };
  throw Error('Paparan demo tidak tersedia.');
}
