export const chatbotMigration = `
CREATE TABLE chatbot_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  bot_name TEXT NOT NULL DEFAULT 'WhatsApp Smart Bot',
  welcome_message TEXT NOT NULL DEFAULT 'Hai! Terima kasih kerana menghubungi kami. Saya adalah pembantu maya automatik anda. 😊',
  ask_name_message TEXT NOT NULL DEFAULT 'Boleh kami tahu nama penuh atau panggilan anda terlebih dahulu?',
  ask_email_message TEXT NOT NULL DEFAULT 'Terima kasih {name}! Sila kongsikan alamat emel anda untuk kami hantarkan maklumat tawaran & resit.',
  qualification_intro TEXT NOT NULL DEFAULT 'Terima kasih {name}! Bagi membolehkan kami memberikan cadangan pakej yang paling tepat, izinkan saya bertanyakan beberapa soalan ringkas.',
  qualification_questions TEXT NOT NULL DEFAULT '[]',
  handoff_message TEXT NOT NULL DEFAULT 'Terima kasih {name}! Maklumat anda telah disahkan dan kami telah maklumkan kepada Pegawai Jualan kami. Pegawai kami akan mengambil alih perbualan ini sebentar sahaja lagi untuk membantu anda. Sila tunggu sebentar ya!',
  handoff_telegram_chat_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE chatbot_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  title TEXT NOT NULL,
  answer TEXT NOT NULL,
  buttons TEXT NOT NULL DEFAULT '[]',
  score_boost INTEGER NOT NULL DEFAULT 15,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_chatbot_knowledge_keyword ON chatbot_knowledge(keyword, is_active);

CREATE TABLE chatbot_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'NEW',
  qualification_score INTEGER NOT NULL DEFAULT 0,
  qualification_answers TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  last_interaction_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_chatbot_leads_phone ON chatbot_leads(phone);
CREATE INDEX idx_chatbot_leads_status ON chatbot_leads(status);

CREATE TABLE chatbot_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_chatbot_messages_phone ON chatbot_messages(phone, id);

CREATE TABLE chatbot_sessions (
  phone TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL DEFAULT 0,
  current_step TEXT NOT NULL DEFAULT 'START',
  current_question_index INTEGER NOT NULL DEFAULT 0,
  collected_data TEXT NOT NULL DEFAULT '{}',
  last_message_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
) STRICT;
`;
