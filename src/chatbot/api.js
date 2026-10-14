import {
  getChatbotConfig,
  updateChatbotConfig,
  listKnowledge,
  getKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  listLeads,
  getLeadByPhone,
  upsertLead,
  listMessages,
  getChatbotStats,
  getSession,
  saveSession
} from './store.js';

export async function handleChatbotApi({ req, res, url, body, databasePath, chatbotEngine, manager }) {
  const route = url.pathname;
  const p = Object.fromEntries(url.searchParams);

  const json = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  };

  // GET Requests
  if (req.method === 'GET') {
    if (route === '/api/chatbot/overview') {
      const config = getChatbotConfig(databasePath);
      const stats = getChatbotStats(databasePath);
      const recentLeads = listLeads(databasePath, { limit: 5 });
      const onlineAccounts = manager?.list ? manager.list().filter(a => a.status === 'ONLINE').map(a => ({
        id: a.id,
        phone: a.phone,
        label: a.label,
        status: a.status
      })) : [];

      return json(200, {
        config: {
          enabled: config.enabled,
          botName: config.botName,
          updatedAt: config.updatedAt
        },
        stats,
        recentLeads: recentLeads.items,
        onlineAccounts
      });
    }

    if (route === '/api/chatbot/config') {
      return json(200, getChatbotConfig(databasePath));
    }

    if (route === '/api/chatbot/knowledge') {
      return json(200, {
        items: listKnowledge(databasePath, { query: p.q || '' })
      });
    }

    if (route === '/api/chatbot/leads') {
      const result = listLeads(databasePath, {
        status: p.status || '',
        query: p.q || '',
        limit: Number(p.limit) || 20,
        offset: (Number(p.page || 1) - 1) * (Number(p.limit) || 20)
      });
      return json(200, result);
    }

    if (route === '/api/chatbot/messages') {
      const phone = p.phone || '';
      return json(200, {
        items: listMessages(databasePath, phone)
      });
    }
  }

  // POST Requests
  if (req.method === 'POST') {
    if (route === '/api/chatbot/config') {
      const updated = updateChatbotConfig(databasePath, body || {});
      return json(200, { success: true, config: updated });
    }

    if (route === '/api/chatbot/knowledge') {
      const created = createKnowledge(databasePath, body || {});
      return json(201, { success: true, item: created });
    }

    if (route === '/api/chatbot/knowledge/update') {
      const id = Number(body?.id);
      if (!id) return json(400, { error: 'ID pengetahuan diperlukan.' });
      const updated = updateKnowledge(databasePath, id, body);
      return json(200, { success: true, item: updated });
    }

    if (route === '/api/chatbot/knowledge/delete') {
      const id = Number(body?.id);
      if (!id) return json(400, { error: 'ID pengetahuan diperlukan.' });
      deleteKnowledge(databasePath, id);
      return json(200, { success: true });
    }

    if (route === '/api/chatbot/leads/update') {
      const phone = body?.phone;
      if (!phone) return json(400, { error: 'Nombor telefon diperlukan.' });
      const updated = upsertLead(databasePath, phone, body);
      return json(200, { success: true, lead: updated });
    }

    // Live Simulator Endpoint
    if (route === '/api/chatbot/simulate') {
      const testPhone = body?.phone || '60123456789';
      const text = body?.text || '';
      const reset = body?.reset === true;

      if (reset) {
        saveSession(databasePath, testPhone, {
          phone: testPhone,
          currentStep: 'START',
          currentQuestionIndex: 0,
          collectedData: {},
          isActive: true
        });
      }

      let simulatedOutbound = null;
      const engine = chatbotEngine || {
        processIncoming: async () => null
      };

      // Temporarily swap or capture outbound response
      const originalSend = engine.onSendWhatsApp;
      engine.onSendWhatsApp = async (payload) => {
        simulatedOutbound = payload;
      };

      try {
        const result = await engine.processIncoming({
          phone: testPhone,
          text,
          messagePayload: { conversation: text },
          accountId: 1
        });

        const currentLead = getLeadByPhone(databasePath, testPhone);
        const currentSession = getSession(databasePath, testPhone);
        const messages = listMessages(databasePath, testPhone, 30);

        return json(200, {
          response: simulatedOutbound || result,
          lead: currentLead,
          session: currentSession,
          messages
        });
      } finally {
        engine.onSendWhatsApp = originalSend;
      }
    }
  }

  return false;
}
