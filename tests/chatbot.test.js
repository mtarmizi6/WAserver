import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeDatabase } from '../src/database/connection.js';
import * as cbStore from '../src/chatbot/store.js';
import { ChatbotEngine } from '../src/chatbot/engine.js';

function setupFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wa-chatbot-test-'));
  const db = join(root, 'app.sqlite');
  initializeDatabase(db);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, db };
}

test('Chatbot Store: Default configuration and knowledge base seeding', t => {
  const { db } = setupFixture(t);

  const config = cbStore.getChatbotConfig(db);
  assert.equal(config.enabled, true);
  assert.ok(config.welcomeMessage.length > 0);
  assert.ok(config.askNameMessage.length > 0);
  assert.ok(config.qualificationQuestions.length >= 2);

  const kbList = cbStore.listKnowledge(db);
  assert.ok(kbList.length >= 3);
  assert.ok(kbList.some(k => k.keyword === 'harga'));
  assert.ok(kbList.some(k => k.keyword === 'pakej'));

  // Test adding new knowledge
  const newKb = cbStore.createKnowledge(db, {
    keyword: 'promosi',
    title: 'Promosi Hujung Bulan',
    answer: 'Diskaun 20% bagi 10 orang terawal.',
    buttons: [{ id: 'btn_claim', text: 'Tuntut Diskaun' }],
    scoreBoost: 25
  });
  assert.equal(newKb.keyword, 'promosi');
  assert.equal(newKb.scoreBoost, 25);

  const matched = cbStore.findKnowledge(db, 'ada promosi tak?');
  assert.ok(matched);
  assert.equal(matched.id, newKb.id);

  // Test updating knowledge
  const updated = cbStore.updateKnowledge(db, newKb.id, { title: 'Tawaran Hebat' });
  assert.equal(updated.title, 'Tawaran Hebat');

  // Test delete
  const deleted = cbStore.deleteKnowledge(db, newKb.id);
  assert.equal(deleted, true);
  assert.equal(cbStore.findKnowledge(db, 'promosi'), null);
});

test('Chatbot Engine: Full 5-step conversational qualification and handoff flow', async t => {
  const { db } = setupFixture(t);
  const sentMessages = [];

  const engine = new ChatbotEngine({
    databasePath: db,
    onSendWhatsApp: async (payload) => {
      sentMessages.push(payload);
    }
  });

  const testPhone = '60123456789';

  // Step 1: Customer sends first greeting
  const res1 = await engine.processIncoming({
    phone: testPhone,
    text: 'Salam, nak tanya tentang servis'
  });

  assert.ok(res1);
  assert.match(res1.text, /nama/i);
  let session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentStep, 'AWAIT_NAME');

  // Step 2: Customer provides Name
  const res2 = await engine.processIncoming({
    phone: testPhone,
    text: 'Nama saya Kamarul'
  });

  assert.ok(res2);
  assert.match(res2.text, /emel/i);
  session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentStep, 'AWAIT_EMAIL');
  assert.equal(session.collectedData.name, 'Kamarul');

  let lead = cbStore.getLeadByPhone(db, testPhone);
  assert.equal(lead.name, 'Kamarul');
  assert.equal(lead.status, 'NEW');

  // Step 3: Customer provides Email
  const res3 = await engine.processIncoming({
    phone: testPhone,
    text: 'kamarul.biz@gmail.com'
  });

  assert.ok(res3);
  session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentStep, 'QUALIFYING');
  assert.equal(session.collectedData.email, 'kamarul.biz@gmail.com');
  // First qualification question sent
  assert.ok(res3.buttons.length > 0);

  // Step 4: Customer answers Question 1 with a button
  const res4 = await engine.processIncoming({
    phone: testPhone,
    text: 'Pakej Premium / Bisnes'
  });

  assert.ok(res4);
  session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentQuestionIndex, 1);

  // Step 5: Customer answers Question 2 via numbered choice "2"
  const res5 = await engine.processIncoming({
    phone: testPhone,
    text: '2'
  });

  assert.ok(res5);
  session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentQuestionIndex, 2);

  // Step 6: Customer answers final Question 3
  const res6 = await engine.processIncoming({
    phone: testPhone,
    text: 'Segera (Minggu ini)'
  });

  assert.ok(res6);
  session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentStep, 'HANDOFF');

  // Lead should now be QUALIFIED with high qualification score!
  lead = cbStore.getLeadByPhone(db, testPhone);
  assert.equal(lead.status, 'QUALIFIED');
  assert.ok(lead.qualificationScore >= 70);
  assert.ok(Object.keys(lead.qualificationAnswers).length >= 2);
});

test('Chatbot Engine: Keyword matching & instant buying signal handoff', async t => {
  const { db } = setupFixture(t);
  const sentMessages = [];

  const engine = new ChatbotEngine({
    databasePath: db,
    onSendWhatsApp: async (payload) => {
      sentMessages.push(payload);
    }
  });

  const testPhone = '60199998888';

  // Seed customer
  cbStore.upsertLead(db, testPhone, { name: 'Farah', status: 'NEW' });
  cbStore.saveSession(db, testPhone, {
    currentStep: 'QUALIFYING',
    currentQuestionIndex: 0,
    collectedData: { name: 'Farah' }
  });

  // Customer types "saya nak beli pakej ni sekarang"
  const res = await engine.processIncoming({
    phone: testPhone,
    text: 'saya nak beli pakej ni sekarang'
  });

  assert.ok(res);
  const session = cbStore.getSession(db, testPhone);
  assert.equal(session.currentStep, 'HANDOFF');

  const lead = cbStore.getLeadByPhone(db, testPhone);
  assert.equal(lead.status, 'QUALIFIED');
});
