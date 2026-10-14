import { loadConfig } from '../system/config.js';
import { sendMessage } from '../telegram/api.js';

export async function sendLeadHandoffAlert({ lead, transcript = [], qualificationAnswers = {}, config = {} }) {
  try {
    const sysConfig = loadConfig();
    const token = sysConfig?.telegram?.botToken;
    const targetChatId = config.handoffTelegramChatId || sysConfig?.telegram?.ownerUserId;

    if (!token || !targetChatId) {
      console.warn('[Chatbot Alert] Telegram botToken atau ownerUserId belum dikonfigurasi.');
      return false;
    }

    const phone = lead.phone;
    const name = lead.name || 'Pelanggan';
    const email = lead.email || '—';
    const score = lead.qualificationScore || 0;

    let answersText = '';
    const answerEntries = Object.entries(qualificationAnswers);
    if (answerEntries.length > 0) {
      answersText = '\n📋 *Jawapan Tapisan:*\n' + answerEntries.map(([k, v]) => `• ${v.question || k}: *${v.selectedText || v.answer || v}*`).join('\n');
    }

    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(`Salam ${name}, saya Pegawai Jualan. Terima kasih kerana berminat dengan servis kami!`)}`;

    let text = `🔥 *PROSPEK BERMINAT (LEAD QUALIFIED)*\n\n` +
      `👤 *Nama:* ${name}\n` +
      `📱 *WhatsApp:* \`+${phone}\`\n` +
      `📧 *Emel:* ${email}\n` +
      `🎯 *Skor Minat:* ${score}/100\n` +
      `⏰ *Masa:* ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' })} MYT\n` +
      answersText + '\n\n' +
      `💬 *Hubungi Terus Pelanggan:*\n${waLink}\n\n` +
      `_Bot telah menyerahkan laluan chat kepada admin._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '💬 Buka WhatsApp Chat', url: waLink }
        ]
      ]
    };

    await sendMessage(token, targetChatId, text, {
      parseMode: 'Markdown',
      replyMarkup: inlineKeyboard
    });
    return true;
  } catch (error) {
    console.error('[Chatbot Alert] Gagal hantar alert Telegram:', error.message || error);
    return false;
  }
}
