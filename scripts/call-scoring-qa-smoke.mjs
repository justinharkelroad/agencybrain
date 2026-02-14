#!/usr/bin/env node
import process from 'node:process';

const config = {
  apiUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  staffSessionToken: process.env.STAFF_SESSION_TOKEN,
  openAiApiKey: process.env.OPENAI_API_KEY,
  callId: process.argv[2],
  question: process.argv.slice(3).join(' ') || process.env.CALL_QA_QUESTION ||
    'Where did umbrella and liability limits come up in the call?',
};

if (!config.staffSessionToken) {
  console.error('[smoke] Missing STAFF_SESSION_TOKEN env var');
  process.exit(1);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_err) {
    const text = await response.text().catch(() => '');
    return { error: text || 'Unparsable response' };
  }
}

async function run() {
  const functionsUrl = `${config.apiUrl}/functions/v1`;
  console.log(`[smoke] API URL: ${config.apiUrl}`);

  const staffCallsRes = await fetch(`${functionsUrl}/get-staff-call-scoring-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-staff-session': config.staffSessionToken,
    },
    body: JSON.stringify({ page: 1, pageSize: 10 }),
  });

  const staffCallsPayload = await safeJson(staffCallsRes);
  console.log(`\n[smoke] get-staff-call-scoring-data -> ${staffCallsRes.status}`);
  console.log(JSON.stringify(staffCallsPayload, null, 2));

  if (!staffCallsRes.ok) {
    process.exit(1);
  }

  const calls = staffCallsPayload?.recent_calls;
  if (!Array.isArray(calls) || calls.length === 0) {
    console.error('[smoke] No calls returned for this session');
    process.exit(1);
  }

  const targetCallId = config.callId || calls[0]?.id;
  if (!targetCallId) {
    console.error('[smoke] Could not determine target call id');
    process.exit(1);
  }

  const qaRes = await fetch(`${functionsUrl}/call-scoring-qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-staff-session': config.staffSessionToken,
      ...(config.openAiApiKey ? { 'x-openai-api-key': config.openAiApiKey } : {}),
    },
    body: JSON.stringify({
      call_id: targetCallId,
      question: config.question,
    }),
  });

  const qaPayload = await safeJson(qaRes);
  console.log(`\n[smoke] call-scoring-qa -> ${qaRes.status}`);
  console.log(JSON.stringify(qaPayload, null, 2));

  if (!qaRes.ok) {
    process.exit(1);
  }

  console.log('\n[smoke] PASS: QA flow executed successfully');
}

run().catch((error) => {
  console.error('[smoke] Unhandled error:', error);
  process.exit(1);
});
