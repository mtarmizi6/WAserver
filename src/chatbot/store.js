import { DatabaseSync } from 'node:sqlite';

const DEFAULT_QUALIFICATION_QUESTIONS = [
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
];

const DEFAULT_KNOWLEDGE_BASE = [
  {
    keyword: 'harga',
    title: 'Harga & Pakej',
    answer: 'Pakej kami bermula serendah RM150 untuk Pakej Asas sehingga RM850 untuk Pakej Lengkap Unlimited. Sila tekan butang di bawah untuk semak butiran atau terus bercakap dengan pegawai kami.',
    buttons: [
      { id: 'btn_pakej', text: 'Lihat Senarai Pakej' },
      { id: 'btn_promo', text: 'Tawaran Diskaun' },
      { id: 'btn_admin', text: 'Hubungi Pegawai' }
    ],
    score_boost: 20
  },
  {
    keyword: 'pakej',
    title: 'Pilihan Pakej Tersedia',
    answer: 'Kami menawarkan 3 pilihan pakej utama: 1) Pakej Starter untuk individu, 2) Pakej Pro untuk perniagaan kecil, 3) Pakej Enterprise untuk syarikat dengan sokongan dedicated.',
    buttons: [
      { id: 'btn_beli', text: 'Berminat Membeli' },
      { id: 'btn_admin', text: 'Bercakap Dengan Admin' }
    ],
    score_boost: 20
  },
  {
    keyword: 'lokasi',
    title: 'Lokasi & Waktu Operasi',
    answer: 'Ibu pejabat kami beroperasi secara atas talian sepenuhnya di Malaysia. Pasukan sokongan kami bertugas setiap hari dari jam 9:00 pagi hingga 10:00 malam.',
    buttons: [
      { id: 'btn_soalan', text: 'Tanya Soalan Lain' },
      { id: 'btn_admin', text: 'Cakap Dengan Admin' }
    ],
    score_boost: 5
  },
  {
    keyword: 'admin',
    title: 'Bantuan Pegawai Manusia',
    answer: 'Boleh! Kami sedang menghubungkan anda dengan Pegawai Jualan kami sekarang. Mohon tunggu sebentar ya.',
    buttons: [
      { id: 'btn_beli', text: 'Saya Nak Order Terus' }
    ],
    score_boost: 30
  },
  {
    keyword: 'beli',
    title: 'Tempahan & Pembelian',
    answer: 'Hebat! Kami sangat berbesar hati untuk membantu pembelian anda. Sila sahkan butiran anda dan pegawai jualan kami akan terus berkongsi link invois/pembayaran.',
    buttons: [
      { id: 'btn_admin', text: 'Teruskan Pembelian' }
    ],
    score_boost: 40
  }
];

function openDb(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  return db;
}

export function getChatbotConfig(databasePath) {
  const db = openDb(databasePath);
  try {
    let row = db.prepare('SELECT * FROM chatbot_config WHERE id = 1').get();
    if (!row) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO chatbot_config (
          id, enabled, bot_name, welcome_message, ask_name_message, ask_email_message,
          qualification_intro, qualification_questions, handoff_message, handoff_telegram_chat_id, updated_at
        ) VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?, '', ?)
      `).run(
        'WhatsApp Smart Bot',
        'Hai! Terima kasih kerana menghubungi kami. Saya adalah pembantu maya automatik anda. 😊',
        'Boleh kami tahu nama penuh atau panggilan anda terlebih dahulu?',
        'Terima kasih {name}! Sila kongsikan alamat emel anda untuk kami hantarkan maklumat tawaran & resit.',
        'Terima kasih {name}! Bagi membolehkan kami memberikan cadangan pakej yang paling tepat, izinkan saya bertanyakan beberapa soalan ringkas.',
        JSON.stringify(DEFAULT_QUALIFICATION_QUESTIONS),
        'Terima kasih {name}! Maklumat anda telah disahkan dan kami telah maklumkan kepada Pegawai Jualan kami. Pegawai kami akan mengambil alih perbualan ini sebentar sahaja lagi untuk membantu anda. Sila tunggu sebentar ya!',
        now
      );
      // Seed default knowledge base if empty
      const kbCount = db.prepare('SELECT count(*) as count FROM chatbot_knowledge').get().count;
      if (kbCount === 0) {
        const insertKb = db.prepare(`
          INSERT INTO chatbot_knowledge (keyword, title, answer, buttons, score_boost, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `);
        for (const item of DEFAULT_KNOWLEDGE_BASE) {
          insertKb.run(item.keyword, item.title, item.answer, JSON.stringify(item.buttons), item.score_boost, now, now);
        }
      }
      row = db.prepare('SELECT * FROM chatbot_config WHERE id = 1').get();
    }
    return {
      id: row.id,
      enabled: row.enabled === 1,
      botName: row.bot_name,
      welcomeMessage: row.welcome_message,
      askNameMessage: row.ask_name_message,
      askEmailMessage: row.ask_email_message,
      qualificationIntro: row.qualification_intro,
      qualificationQuestions: JSON.parse(row.qualification_questions || '[]'),
      handoffMessage: row.handoff_message,
      handoffTelegramChatId: row.handoff_telegram_chat_id || '',
      updatedAt: row.updated_at
    };
  } finally {
    db.close();
  }
}

export function updateChatbotConfig(databasePath, updates = {}) {
  const current = getChatbotConfig(databasePath);
  const db = openDb(databasePath);
  try {
    const updated = {
      enabled: updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
      bot_name: updates.botName !== undefined ? String(updates.botName).trim() : current.botName,
      welcome_message: updates.welcomeMessage !== undefined ? String(updates.welcomeMessage).trim() : current.welcomeMessage,
      ask_name_message: updates.askNameMessage !== undefined ? String(updates.askNameMessage).trim() : current.askNameMessage,
      ask_email_message: updates.askEmailMessage !== undefined ? String(updates.askEmailMessage).trim() : current.askEmailMessage,
      qualification_intro: updates.qualificationIntro !== undefined ? String(updates.qualificationIntro).trim() : current.qualificationIntro,
      qualification_questions: updates.qualificationQuestions !== undefined ? JSON.stringify(updates.qualificationQuestions) : JSON.stringify(current.qualificationQuestions),
      handoff_message: updates.handoffMessage !== undefined ? String(updates.handoffMessage).trim() : current.handoffMessage,
      handoff_telegram_chat_id: updates.handoffTelegramChatId !== undefined ? String(updates.handoffTelegramChatId).trim() : current.handoffTelegramChatId,
      updated_at: new Date().toISOString()
    };
    db.prepare(`
      UPDATE chatbot_config SET
        enabled = ?, bot_name = ?, welcome_message = ?, ask_name_message = ?,
        ask_email_message = ?, qualification_intro = ?, qualification_questions = ?,
        handoff_message = ?, handoff_telegram_chat_id = ?, updated_at = ?
      WHERE id = 1
    `).run(
      updated.enabled, updated.bot_name, updated.welcome_message, updated.ask_name_message,
      updated.ask_email_message, updated.qualification_intro, updated.qualification_questions,
      updated.handoff_message, updated.handoff_telegram_chat_id, updated.updated_at
    );
    return getChatbotConfig(databasePath);
  } finally {
    db.close();
  }
}

export function listKnowledge(databasePath, { query = '', onlyActive = false } = {}) {
  const db = openDb(databasePath);
  try {
    let sql = 'SELECT * FROM chatbot_knowledge';
    const params = [];
    const conditions = [];
    if (onlyActive) {
      conditions.push('is_active = 1');
    }
    if (query) {
      conditions.push('(keyword LIKE ? OR title LIKE ? OR answer LIKE ?)');
      const term = `%${query}%`;
      params.push(term, term, term);
    }
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY score_boost DESC, id ASC';
    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({
      id: r.id,
      keyword: r.keyword,
      title: r.title,
      answer: r.answer,
      buttons: JSON.parse(r.buttons || '[]'),
      scoreBoost: r.score_boost,
      isActive: r.is_active === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } finally {
    db.close();
  }
}

export function getKnowledge(databasePath, id) {
  const db = openDb(databasePath);
  try {
    const row = db.prepare('SELECT * FROM chatbot_knowledge WHERE id = ?').get(Number(id));
    if (!row) return null;
    return {
      id: row.id,
      keyword: row.keyword,
      title: row.title,
      answer: row.answer,
      buttons: JSON.parse(row.buttons || '[]'),
      scoreBoost: row.score_boost,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } finally {
    db.close();
  }
}

export function createKnowledge(databasePath, data = {}) {
  const db = openDb(databasePath);
  try {
    const now = new Date().toISOString();
    const keyword = String(data.keyword || '').trim().toLowerCase();
    const title = String(data.title || data.keyword || '').trim();
    const answer = String(data.answer || '').trim();
    if (!keyword) throw new Error('Keyword diperlukan.');
    if (!answer) throw new Error('Jawapan diperlukan.');
    const buttons = Array.isArray(data.buttons) ? JSON.stringify(data.buttons) : '[]';
    const scoreBoost = Number(data.scoreBoost ?? 15);
    const result = db.prepare(`
      INSERT INTO chatbot_knowledge (keyword, title, answer, buttons, score_boost, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(keyword, title, answer, buttons, scoreBoost, now, now);
    return getKnowledge(databasePath, result.lastInsertRowid);
  } finally {
    db.close();
  }
}

export function updateKnowledge(databasePath, id, data = {}) {
  const db = openDb(databasePath);
  try {
    const existing = getKnowledge(databasePath, id);
    if (!existing) throw new Error('Knowledge base rekod tidak dijumpai.');
    const now = new Date().toISOString();
    const keyword = data.keyword !== undefined ? String(data.keyword).trim().toLowerCase() : existing.keyword;
    const title = data.title !== undefined ? String(data.title).trim() : existing.title;
    const answer = data.answer !== undefined ? String(data.answer).trim() : existing.answer;
    const buttons = data.buttons !== undefined ? JSON.stringify(data.buttons) : JSON.stringify(existing.buttons);
    const scoreBoost = data.scoreBoost !== undefined ? Number(data.scoreBoost) : existing.scoreBoost;
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : (existing.isActive ? 1 : 0);

    db.prepare(`
      UPDATE chatbot_knowledge SET
        keyword = ?, title = ?, answer = ?, buttons = ?, score_boost = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(keyword, title, answer, buttons, scoreBoost, isActive, now, Number(id));
    return getKnowledge(databasePath, id);
  } finally {
    db.close();
  }
}

export function deleteKnowledge(databasePath, id) {
  const db = openDb(databasePath);
  try {
    const res = db.prepare('DELETE FROM chatbot_knowledge WHERE id = ?').run(Number(id));
    return res.changes > 0;
  } finally {
    db.close();
  }
}

export function findKnowledge(databasePath, inputMessage = '') {
  const text = String(inputMessage || '').trim().toLowerCase();
  if (!text) return null;
  const list = listKnowledge(databasePath, { onlyActive: true });
  // Priority 1: Exact match on keyword or button text
  for (const item of list) {
    if (text === item.keyword || text === item.title.toLowerCase()) return item;
    for (const btn of item.buttons) {
      if (text === btn.id.toLowerCase() || text === btn.text.toLowerCase()) return item;
    }
  }
  // Priority 2: Keyword contained as substring
  for (const item of list) {
    const words = item.keyword.split(',').map(w => w.trim()).filter(Boolean);
    for (const w of words) {
      if (text.includes(w)) return item;
    }
  }
  return null;
}

export function listLeads(databasePath, { status = '', query = '', limit = 50, offset = 0 } = {}) {
  const db = openDb(databasePath);
  try {
    let sql = 'SELECT * FROM chatbot_leads';
    const params = [];
    const conditions = [];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (query) {
      conditions.push('(phone LIKE ? OR name LIKE ? OR email LIKE ?)');
      const term = `%${query}%`;
      params.push(term, term, term);
    }
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY qualification_score DESC, last_interaction_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 50, Number(offset) || 0);

    const rows = db.prepare(sql).all(...params);
    const countSql = 'SELECT count(*) as total FROM chatbot_leads' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '');
    const countParams = params.slice(0, -2);
    const total = db.prepare(countSql).get(...countParams)?.total || 0;

    return {
      items: rows.map(r => ({
        id: r.id,
        phone: r.phone,
        name: r.name,
        email: r.email,
        status: r.status,
        qualificationScore: r.qualification_score,
        qualificationAnswers: JSON.parse(r.qualification_answers || '{}'),
        notes: r.notes,
        lastInteractionAt: r.last_interaction_at,
        createdAt: r.created_at
      })),
      total,
      limit,
      offset
    };
  } finally {
    db.close();
  }
}

export function getLeadByPhone(databasePath, phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return null;
  const db = openDb(databasePath);
  try {
    const r = db.prepare('SELECT * FROM chatbot_leads WHERE phone = ?').get(cleanPhone);
    if (!r) return null;
    return {
      id: r.id,
      phone: r.phone,
      name: r.name,
      email: r.email,
      status: r.status,
      qualificationScore: r.qualification_score,
      qualificationAnswers: JSON.parse(r.qualification_answers || '{}'),
      notes: r.notes,
      lastInteractionAt: r.last_interaction_at,
      createdAt: r.created_at
    };
  } finally {
    db.close();
  }
}

export function upsertLead(databasePath, phone, data = {}) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) throw new Error('Nombor telefon diperlukan.');
  const db = openDb(databasePath);
  try {
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM chatbot_leads WHERE phone = ?').get(cleanPhone);
    if (existing) {
      const name = data.name !== undefined ? String(data.name).trim() : existing.name;
      const email = data.email !== undefined ? String(data.email).trim() : existing.email;
      const status = data.status !== undefined ? String(data.status).trim() : existing.status;
      const qualificationScore = data.qualificationScore !== undefined ? Number(data.qualificationScore) : existing.qualification_score;
      const answers = data.qualificationAnswers !== undefined ? JSON.stringify(data.qualificationAnswers) : existing.qualification_answers;
      const notes = data.notes !== undefined ? String(data.notes).trim() : existing.notes;

      db.prepare(`
        UPDATE chatbot_leads SET
          name = ?, email = ?, status = ?, qualification_score = ?, qualification_answers = ?,
          notes = ?, last_interaction_at = ?
        WHERE phone = ?
      `).run(name, email, status, qualificationScore, answers, notes, now, cleanPhone);
    } else {
      const name = String(data.name || '').trim();
      const email = String(data.email || '').trim();
      const status = String(data.status || 'NEW').trim();
      const qualificationScore = Number(data.qualificationScore || 0);
      const answers = data.qualificationAnswers ? JSON.stringify(data.qualificationAnswers) : '{}';
      const notes = String(data.notes || '').trim();

      db.prepare(`
        INSERT INTO chatbot_leads (
          phone, name, email, status, qualification_score, qualification_answers,
          notes, last_interaction_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cleanPhone, name, email, status, qualificationScore, answers, notes, now, now);
    }
    return getLeadByPhone(databasePath, cleanPhone);
  } finally {
    db.close();
  }
}

export function getSession(databasePath, phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return null;
  const db = openDb(databasePath);
  try {
    const row = db.prepare('SELECT * FROM chatbot_sessions WHERE phone = ?').get(cleanPhone);
    if (!row) return null;
    return {
      phone: row.phone,
      accountId: row.account_id,
      currentStep: row.current_step,
      currentQuestionIndex: row.current_question_index,
      collectedData: JSON.parse(row.collected_data || '{}'),
      lastMessageAt: row.last_message_at,
      isActive: row.is_active === 1
    };
  } finally {
    db.close();
  }
}

export function saveSession(databasePath, phone, session = {}) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) throw new Error('Nombor telefon sesi diperlukan.');
  const db = openDb(databasePath);
  try {
    const now = new Date().toISOString();
    const accountId = Number(session.accountId || 0);
    const currentStep = String(session.currentStep || 'START');
    const currentQuestionIndex = Number(session.currentQuestionIndex || 0);
    const collectedData = session.collectedData ? JSON.stringify(session.collectedData) : '{}';
    const isActive = session.isActive !== false ? 1 : 0;

    db.prepare(`
      INSERT INTO chatbot_sessions (phone, account_id, current_step, current_question_index, collected_data, last_message_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        account_id = excluded.account_id,
        current_step = excluded.current_step,
        current_question_index = excluded.current_question_index,
        collected_data = excluded.collected_data,
        last_message_at = excluded.last_message_at,
        is_active = excluded.is_active
    `).run(cleanPhone, accountId, currentStep, currentQuestionIndex, collectedData, now, isActive);
    return getSession(databasePath, cleanPhone);
  } finally {
    db.close();
  }
}

export function recordMessage(databasePath, { phone, direction, messageType = 'TEXT', content = '' }) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return;
  const db = openDb(databasePath);
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO chatbot_messages (phone, direction, message_type, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(cleanPhone, direction, messageType, String(content), now);
  } finally {
    db.close();
  }
}

export function listMessages(databasePath, phone, limit = 50) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return [];
  const db = openDb(databasePath);
  try {
    return db.prepare(`
      SELECT * FROM chatbot_messages WHERE phone = ? ORDER BY id ASC LIMIT ?
    `).all(cleanPhone, Number(limit) || 50);
  } finally {
    db.close();
  }
}

export function getChatbotStats(databasePath) {
  const db = openDb(databasePath);
  try {
    const totalLeads = db.prepare('SELECT count(*) as count FROM chatbot_leads').get()?.count || 0;
    const qualifiedLeads = db.prepare("SELECT count(*) as count FROM chatbot_leads WHERE status = 'QUALIFIED' OR status = 'HANDOFF'").get()?.count || 0;
    const newLeads = db.prepare("SELECT count(*) as count FROM chatbot_leads WHERE status = 'NEW'").get()?.count || 0;
    const totalKb = db.prepare('SELECT count(*) as count FROM chatbot_knowledge WHERE is_active = 1').get()?.count || 0;
    const totalMessages = db.prepare('SELECT count(*) as count FROM chatbot_messages').get()?.count || 0;

    return {
      totalLeads,
      qualifiedLeads,
      newLeads,
      totalKb,
      totalMessages
    };
  } finally {
    db.close();
  }
}
