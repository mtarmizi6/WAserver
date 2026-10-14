export function attachChatbotToWhatsApp(manager, chatbotEngine) {
  if (!manager || !chatbotEngine) return;

  manager.on('personal_message', async ({ accountId, message }) => {
    try {
      const rawJid = String(message?.key?.remoteJid || '');
      if (!rawJid.endsWith('@s.whatsapp.net')) return;
      // Skip status, broadcast, or system messages
      if (rawJid.includes('broadcast') || rawJid.includes('newsletter')) return;

      const phone = rawJid.replace(/@s\.whatsapp\.net$/, '');
      await chatbotEngine.processIncoming({
        phone,
        messagePayload: message.message,
        accountId
      });
    } catch (error) {
      console.error('[Chatbot Handler] Ralat memproses mesej WhatsApp masuk:', error.message || error);
    }
  });
}
