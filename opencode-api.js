#!/usr/bin/env node
/**
 * opencode-api.js — drive the local OpenCode service over its raw HTTP API.
 *
 * Discovers the running OpenCode V2 background service (endpoint + secret
 * from ~/.local/state/opencode/service.json), authenticates with HTTP Basic,
 * creates a session, sends a prompt, and polls until the assistant reply is
 * done. No dependencies: uses Node's built-in fetch (Node 22+).
 *
 * Usage:
 *   node opencode-api.js ["<prompt text>" ...]   # one-shot: create session, prompt, print reply
 *   node opencode-api.js --info                  # print /api/info and exit
 *   node opencode-api.js --server <url>          # override service URL
 *
 * Env: OPENCODE_SERVICE_FILE  override path to the service registration JSON.
 */

'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');

const DEFAULT_SERVICE_FILE = process.env.OPENCODE_SERVICE_FILE ||
  join(homedir(), '.local', 'state', 'opencode', 'service.json');

function die(message) {
  console.error(`error: ${message}`);
  console.error('hint: keep the OpenCode desktop app / service running so /api/* routes are available.');
  process.exit(1);
}

function loadService(file = DEFAULT_SERVICE_FILE) {
  if (!existsSync(file)) {
    die(`service registration not found at ${file}`);
  }
  let registration;
  try {
    registration = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    die(`could not parse ${file}: ${error.message}`);
  }
  if (!registration.url || !registration.password) {
    die(`service registration at ${file} is missing "url" or "password"`);
  }
  return {
    url: process.env.OPENCODE_SERVER_URL || registration.url,
    password: registration.password,
    file,
  };
}

function authHeader(password) {
  // The service expects HTTP Basic with username "opencode".
  const token = Buffer.from(`opencode:${password}`).toString('base64');
  return `Basic ${token}`;
}

async function request(service, path, { method = 'GET', body } = {}) {
  const headers = { authorization: authHeader(service.password) };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(`${service.url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    die(`HTTP ${response.status} ${method} ${path}: ${text}`);
  }
  // Some routes wrap the payload in { data: ... }, others return it directly.
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

// --- API operations ------------------------------------------------------

async function getInfo(service) {
  return await request(service, '/api/info');
}

async function createSession(service, directory) {
  return request(service, '/api/session', {
    method: 'POST',
    body: { location: { directory } },
  });
}

async function sendPrompt(service, sessionID, text) {
  return request(service, `/api/session/${sessionID}/prompt`, {
    method: 'POST',
    body: { text },
  });
}

async function listMessages(service, sessionID) {
  return request(service, `/api/session/${sessionID}/message`);
}

// --- polling helper ------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until the assistant turns are complete: an "idle" message with a
 * terminal outcome is emitted when the agent finishes. Resolves with the
 * final assistant messages' text content.
 */
async function waitForReply(service, sessionID, { timeoutMs = 120_000, pollMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() > deadline) {
      die(`timed out after ${timeoutMs}ms waiting for the assistant reply`);
    }
    const messages = await listMessages(service, sessionID);
    const idle = messages.find((message) => message.type === 'idle');
    if (idle && idle.outcome === 'succeeded') {
      const assistant = messages.find((message) => message.type === 'assistant');
      if (!assistant) {
        return { texts: [], tokens: null };
      }
      const texts = (assistant.content || [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text);
      return { texts, tokens: assistant.tokens || null };
    }
    if (idle && idle.outcome !== 'running') {
      die(`assistant turn ended with outcome "${idle.outcome}"`);
    }
    await sleep(pollMs);
  }
}

// --- CLI -----------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const service = loadService();

  const serverIndex = args.indexOf('--server');
  if (serverIndex !== -1 && args[serverIndex + 1]) {
    service.url = args[serverIndex + 1];
    args.splice(serverIndex, 2);
  }

  if (args.includes('--info')) {
    const info = await getInfo(service);
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  const promptText = args.join(' ').trim() || 'Reply with exactly: OK';
  const cwd = process.cwd();

  console.error(`# creating session in ${cwd}`);
  const session = await createSession(service, cwd);
  console.error(`# session ${session.id}`);
  console.error(`# prompting: ${promptText}`);
  await sendPrompt(service, session.id, promptText);

  const { texts, tokens } = await waitForReply(service, session.id);
  for (const text of texts) {
    console.log(text);
  }
  if (tokens) {
    console.error(`# tokens in=${tokens.input} out=${tokens.output} cache=${tokens.cache.read}`);
  }
}

main().catch((error) => {
  console.error('error:', error.message);
  process.exit(1);
});