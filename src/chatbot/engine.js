import {
  getChatbotConfig,
  listKnowledge,
  findKnowledge,
  getLeadByPhone,
  upsertLead,
  getSession,
  saveSession,
  recordMessage
} from './store.js';
import { sendLeadHandoffAlert } from './telegram-alert.js';

export function normalizePhone(rawPhone) {
  return String(rawPhone || '').replace(/:\d+@.*$/, '').replace(/@.*$/, '').replace(/\D/g, '');
}

export function extractMessageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return message.trim();

  // Plain text
  if (message.conversation) return message.conversation.trim();
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text.trim();

  // Button responses
  if (message.buttonsResponseMessage?.selectedButtonId) {
    return message.buttonsResponseMessage.selectedButtonId.trim();
  }
  if (message.templateButtonReplyMessage?.selectedId) {
    return message.templateButtonReplyMessage.selectedId.trim();
  }
  if (message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const params = JSON.parse(message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      if (params.id) return String(params.id).trim();
    } catch {}
  }
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return message.listResponseMessage.singleSelectReply.selectedRowId.trim();
  }

  // Captions
  if (message.imageMessage?.caption) return message.imageMessage.caption.trim();
  if (message.videoMessage?.caption) return message.videoMessage.caption.trim();

  return '';
}

export class ChatbotEngine {
  constructor({ databasePath, onSendWhatsApp }) {
    this.databasePath = databasePath;
    this.onSendWhatsApp = onSendWhatsApp || (async () => {});
  }

  async processIncoming({ phone, text, messagePayload, accountId = 0 }) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) return null;

    const config = getChatbotConfig(this.databasePath);
    if (!config.enabled) {
      return null;
    }

    const incomingText = extractMessageText(messagePayload) || String(text || '').trim();
    if (!incomingText) return null;

    // Record inbound message
    recordMessage(this.databasePath, {
      phone: cleanPhone,
      direction: 'INBOUND',
      messageType: 'TEXT',
      content: incomingText
    });

    let session = getSession(this.databasePath, cleanPhone);
    let lead = getLeadByPhone(this.databasePath, cleanPhone);

    const now = Date.now();
    const lastActive = session?.lastMessageAt ? Date.parse(session.lastMessageAt) : 0;
    const isStale = (now - lastActive) > (24 * 60 * 60 * 1000); // 24 hours reset window

    // Reset command support
    const isResetCmd = /^(mula|reset|start|menu|hi|hai|salam|hello)$/i.test(incomingText.toLowerCase());

    if (!session || (isStale && isResetCmd)) {
      session = {
        phone: cleanPhone,
        accountId,
        currentStep: 'START',
        currentQuestionIndex: 0,
        collectedData: lead ? { name: lead.name, email: lead.email, answers: lead.qualificationAnswers } : {},
        isActive: true
      };
    }

    // State machine execution
    const response = await this.evaluateState(cleanPhone, incomingText, session, lead, config, accountId);

    if (response) {
      // Record outbound message
      recordMessage(this.databasePath, {
        phone: cleanPhone,
        direction: 'OUTBOUND',
        messageType: response.buttons?.length ? 'INTERACTIVE' : 'TEXT',
        content: response.text
      });

      // Dispatch through WhatsApp sender
      await this.onSendWhatsApp({
        accountId,
        phone: cleanPhone,
        text: response.text,
        buttons: response.buttons || []
      });
    }

    return response;
  }

  async evaluateState(phone, input, session, lead, config, accountId) {
    const trimmedInput = input.trim();
    const lowerInput = trimmedInput.toLowerCase();

    // Check if user is currently already handed off to human admin
    if (session.currentStep === 'HANDOFF') {
      // If customer explicitly requests to restart chatbot
      if (['mula semula', 'reset', 'menu', 'start'].includes(lowerInput)) {
        session.currentStep = 'QUALIFYING';
        session.currentQuestionIndex = 0;
        saveSession(this.databasePath, phone, session);
        return this.sendFirstQualificationQuestion(phone, session, config);
      }

      // Check if matching any specific knowledge base keywords
      const kbMatch = findKnowledge(this.databasePath, trimmedInput);
      if (kbMatch) {
        return {
          text: `${kbMatch.answer}\n\n_(Nota: Pegawai kami juga telah dimaklumkan dan akan menyambung chat ini sebentar lagi.)_`,
          buttons: kbMatch.buttons
        };
      }

      return {
        text: `Mesej anda telah diterima. Pegawai kami sedang meneliti perbualan anda dan akan membalas mesej ini secepat mungkin. Terima kasih atas kesabaran anda! 😊\n\n_(Taip "menu" jika ingin memilih semula pilihan soalan)._`,
        buttons: [
          { id: 'btn_reset', text: 'Mula Semula' },
          { id: 'btn_faq', text: 'Pakej & Harga' }
        ]
      };
    }

    // Step 1: START -> Send Welcome and Ask for Name
    if (session.currentStep === 'START') {
      session.currentStep = 'AWAIT_NAME';
      saveSession(this.databasePath, phone, session);

      const welcomeText = `${config.welcomeMessage}\n\n${config.askNameMessage}`;
      return {
        text: welcomeText,
        buttons: []
      };
    }

    // Step 2: AWAIT_NAME -> Receive Name, Ask for Email
    if (session.currentStep === 'AWAIT_NAME') {
      const name = trimmedInput.replace(/^(saya\s+|nama\s+saya\s+|panggil\s+|i\s+am\s+)/i, '').trim();
      if (name.length < 2) {
        return {
          text: `Mohon kongsikan nama panggilan anda yang betul ya supaya memudahkan kami melayan anda:`,
          buttons: []
        };
      }

      session.collectedData.name = name;
      session.currentStep = 'AWAIT_EMAIL';
      saveSession(this.databasePath, phone, session);

      upsertLead(this.databasePath, phone, {
        name,
        status: 'NEW',
        qualificationScore: 10
      });

      const askEmailText = config.askEmailMessage.replace(/\{name\}/g, name);
      return {
        text: askEmailText,
        buttons: [
          { id: 'btn_skip_email', text: 'Tiada Emel / Langkau' }
        ]
      };
    }

    // Step 3: AWAIT_EMAIL -> Receive Email, Start Qualification
    if (session.currentStep === 'AWAIT_EMAIL') {
      const name = session.collectedData.name || 'Tuan/Puan';
      let email = trimmedInput;
      const isSkip = /^(tiada|skip|langkau|tak ada|tiada emel|btn_skip_email)$/i.test(lowerInput);

      if (isSkip) {
        email = 'tiada@emel.com';
      } else {
        // Simple regex check for valid email
        const emailMatch = trimmedInput.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          email = emailMatch[0];
        } else if (!trimmedInput.includes('@')) {
          return {
            text: `Format emel kelihatan kurang tepat. Sila taip alamat emel yang sah (contoh: ${name.toLowerCase().replace(/\s+/g, '')}@gmail.com) atau tekan butang di bawah untuk langkau:`,
            buttons: [
              { id: 'btn_skip_email', text: 'Tiada Emel / Langkau' }
            ]
          };
        }
      }

      session.collectedData.email = email;
      session.collectedData.answers = {};
      session.currentStep = 'QUALIFYING';
      session.currentQuestionIndex = 0;
      saveSession(this.databasePath, phone, session);

      upsertLead(this.databasePath, phone, {
        name,
        email,
        status: 'NEW',
        qualificationScore: 20
      });

      // Start qualification flow
      return this.sendFirstQualificationQuestion(phone, session, config);
    }

    // Step 4: QUALIFYING -> Answer Questions
    if (session.currentStep === 'QUALIFYING') {
      const name = session.collectedData.name || 'Tuan/Puan';
      const questions = config.qualificationQuestions || [];
      const currentIndex = session.currentQuestionIndex || 0;
      const currentQuestion = questions[currentIndex];

      if (!currentQuestion) {
        // No more questions -> Trigger Handoff
        return this.triggerHandoff(phone, session, config, accountId);
      }

      // Check which option was picked
      let matchedOption = null;
      for (const opt of currentQuestion.options) {
        if (
          lowerInput === opt.id.toLowerCase() ||
          lowerInput === opt.text.toLowerCase() ||
          lowerInput.includes(opt.text.toLowerCase())
        ) {
          matchedOption = opt;
          break;
        }
      }

      // Also support numbered selection "1", "2", "3"
      const numPick = parseInt(trimmedInput, 10);
      if (!matchedOption && !isNaN(numPick) && numPick >= 1 && numPick <= currentQuestion.options.length) {
        matchedOption = currentQuestion.options[numPick - 1];
      }

      // If user typed something outside options, check if they matched a knowledge keyword
      if (!matchedOption) {
        const kbMatch = findKnowledge(this.databasePath, trimmedInput);
        if (kbMatch) {
          // If knowledge match has admin/buy signal, handoff immediately
          if (kbMatch.keyword === 'admin' || kbMatch.keyword === 'beli') {
            return this.triggerHandoff(phone, session, config, accountId);
          }
          return {
            text: `${kbMatch.answer}\n\nSila pilih jawapan untuk soalan sebelum ini:\n*${currentQuestion.question}*`,
            buttons: currentQuestion.options.map(o => ({ id: o.id, text: o.text }))
          };
        }

        // Prompt to select from options
        return {
          text: `Sila buat pilihan untuk soalan berikut:\n\n*${currentQuestion.question}*`,
          buttons: currentQuestion.options.map(o => ({ id: o.id, text: o.text }))
        };
      }

      // Save answer
      session.collectedData.answers = session.collectedData.answers || {};
      session.collectedData.answers[currentQuestion.id] = {
        question: currentQuestion.question,
        selectedId: matchedOption.id,
        selectedText: matchedOption.text,
        score: matchedOption.score || 10
      };

      // Calculate new score
      const currentLead = getLeadByPhone(this.databasePath, phone);
      const newScore = (currentLead?.qualificationScore || 20) + (matchedOption.score || 10);

      upsertLead(this.databasePath, phone, {
        qualificationScore: newScore,
        qualificationAnswers: session.collectedData.answers
      });

      // Check next question
      const nextIndex = currentIndex + 1;
      if (nextIndex < questions.length) {
        session.currentQuestionIndex = nextIndex;
        saveSession(this.databasePath, phone, session);

        const nextQuestion = questions[nextIndex];
        return {
          text: `👍 *Soalan ${nextIndex + 1}/${questions.length}:*\n${nextQuestion.question}`,
          buttons: nextQuestion.options.map(o => ({ id: o.id, text: o.text }))
        };
      } else {
        // Completed all qualification questions -> Handoff to Admin!
        return this.triggerHandoff(phone, session, config, accountId);
      }
    }

    // Default Fallback
    const kbMatch = findKnowledge(this.databasePath, trimmedInput);
    if (kbMatch) {
      if (kbMatch.keyword === 'admin' || kbMatch.keyword === 'beli') {
        return this.triggerHandoff(phone, session, config, accountId);
      }
      return {
        text: kbMatch.answer,
        buttons: kbMatch.buttons
      };
    }

    return {
      text: `Hai ${session.collectedData.name || ''}! Bagaimana kami boleh bantu anda hari ini? Anda boleh pilih topik di bawah atau terus berhubung dengan Pegawai kami.`,
      buttons: [
        { id: 'btn_pakej', text: 'Pakej & Harga' },
        { id: 'btn_admin', text: 'Bercakap Dengan Admin' }
      ]
    };
  }

  sendFirstQualificationQuestion(phone, session, config) {
    const name = session.collectedData.name || 'Tuan/Puan';
    const questions = config.qualificationQuestions || [];

    if (!questions.length) {
      session.currentStep = 'KB_QA';
      saveSession(this.databasePath, phone, session);
      return {
        text: `Terima kasih ${name}! Maklumat anda telah kami rekodkan. Sila pilih topik di bawah atau terus hubungi pegawai kami:`,
        buttons: [
          { id: 'btn_pakej', text: 'Senarai Pakej' },
          { id: 'btn_admin', text: 'Hubungi Pegawai' }
        ]
      };
    }

    const firstQ = questions[0];
    const introText = config.qualificationIntro.replace(/\{name\}/g, name);
    return {
      text: `${introText}\n\n*Soalan 1/${questions.length}:*\n${firstQ.question}`,
      buttons: firstQ.options.map(o => ({ id: o.id, text: o.text }))
    };
  }

  async triggerHandoff(phone, session, config, accountId) {
    const name = session.collectedData.name || 'Pelanggan';
    session.currentStep = 'HANDOFF';
    saveSession(this.databasePath, phone, session);

    const lead = getLeadByPhone(this.databasePath, phone);
    const updatedLead = upsertLead(this.databasePath, phone, {
      status: 'QUALIFIED',
      notes: 'Selesai tapisan & sedia untuk admin'
    });

    // Fire Telegram Alert to Admin
    sendLeadHandoffAlert({
      lead: updatedLead || lead,
      qualificationAnswers: session.collectedData.answers || {},
      config
    }).catch(err => console.error('[Engine Alert Error]:', err));

    const handoffText = config.handoffMessage.replace(/\{name\}/g, name);
    return {
      text: handoffText,
      buttons: [
        { id: 'btn_faq', text: 'Lihat Info Pakej' },
        { id: 'btn_reset', text: 'Mula Semula' }
      ]
    };
  }
}
