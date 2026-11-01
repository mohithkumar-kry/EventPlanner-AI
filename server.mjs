import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const requestWindows = new Map();

try {
  const envText = await readFile(join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch {}

const port = Number(process.env.PORT || 4173);

const planSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventTitle: { type: 'string' },
    summary: { type: 'string' },
    budgetBreakdown: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { category: { type: 'string' }, amount: { type: 'integer' }, note: { type: 'string' } }, required: ['category', 'amount', 'note'] } },
    timeline: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, dueDate: { type: 'string' }, phase: { type: 'string' }, detail: { type: 'string' } }, required: ['title', 'dueDate', 'phase', 'detail'] } },
    vendorChecklist: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { category: { type: 'string' }, task: { type: 'string' }, tip: { type: 'string' } }, required: ['category', 'task', 'tip'] } },
    ideas: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, detail: { type: 'string' } }, required: ['title', 'detail'] } }
  },
  required: ['eventTitle', 'summary', 'budgetBreakdown', 'timeline', 'vendorChecklist', 'ideas']
};

const assistantTools = [
  { type: 'function', name: 'add_task', description: 'Add a task to the user’s local event calendar when they ask you to schedule or add it.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD, or empty if the user did not specify a date.' }, time: { type: 'string', description: '24-hour HH:MM, or empty if unspecified.' }, details: { type: 'string' }, tag: { type: 'string' } }, required: ['title', 'date', 'time', 'details', 'tag'] } },
  { type: 'function', name: 'edit_task', description: 'Edit an existing task by its id. Only use when user asks to change it.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { task_id: { type: 'string' }, title: { type: ['string', 'null'] }, date: { type: ['string', 'null'] }, time: { type: ['string', 'null'] }, details: { type: ['string', 'null'] }, completed: { type: ['boolean', 'null'] } }, required: ['task_id', 'title', 'date', 'time', 'details', 'completed'] } },
  { type: 'function', name: 'delete_task', description: 'Delete an existing task by its id only when user clearly asks to remove it.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { type: 'function', name: 'add_event', description: 'Create and generate an event plan when user asks to plan or add a new wedding, birthday, or community event. Use reasonable defaults only for omitted guest count, budget, or currency; date is required.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, type: { type: 'string', enum: ['Wedding', 'Birthday', 'Community event'] }, date: { type: 'string' }, guests: { type: 'integer' }, budget: { type: 'integer' }, currency: { type: 'string', enum: ['USD', 'INR', 'GBP', 'EUR'] }, location: { type: 'string' }, preferences: { type: 'string' } }, required: ['title', 'type', 'date', 'guests', 'budget', 'currency', 'location', 'preferences'] } },
  { type: 'function', name: 'update_event', description: 'Update the active event details when the user asks to change them. Null means leave a field unchanged.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { title: { type: ['string', 'null'] }, type: { type: ['string', 'null'] }, date: { type: ['string', 'null'] }, guests: { type: ['integer', 'null'] }, budget: { type: ['integer', 'null'] }, currency: { type: ['string', 'null'] }, location: { type: ['string', 'null'] }, preferences: { type: ['string', 'null'] } }, required: ['title', 'type', 'date', 'guests', 'budget', 'currency', 'location', 'preferences'] } },
  { type: 'function', name: 'navigate_calendar', description: 'Open a date or switch calendar display when user asks to see a date, week, month, or agenda.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { date: { type: 'string' }, view: { type: 'string', enum: ['month', 'week', 'agenda'] } }, required: ['date', 'view'] } }
];

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req, maxBytes = 24_000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBytes) { const error = new Error('Request is too large.'); error.status = 413; throw error; }
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Please send valid JSON.'); }
}

function setSecurityHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}

function enforceRateLimit(key, limit, windowMs) {
  const now = Date.now(), recent = (requestWindows.get(key) || []).filter(time => now - time < windowMs);
  if (recent.length >= limit) { const error = new Error('You have made several AI requests. Please wait a little and try again.'); error.status = 429; throw error; }
  recent.push(now); requestWindows.set(key, recent);
  if (requestWindows.size > 10_000) for (const [id, times] of requestWindows) if (!times.some(time => now - time < 15 * 60_000)) requestWindows.delete(id);
}

function allowAppOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  const allowed = new Set(process.env.APP_ORIGIN ? [new URL(process.env.APP_ORIGIN).origin] : []);
  if (!process.env.K_SERVICE) {
    allowed.add(`http://localhost:${port}`);
    allowed.add(`http://127.0.0.1:${port}`);
  }
  if (allowed.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'Content-Type');
    res.setHeader('vary', 'Origin');
    return;
  }
  const error = new Error('This EventCraft API is not configured for this website address. Set APP_ORIGIN to your GitHub Pages site URL.');
  error.status = 403;
  throw error;
}


function validateEvent(event) {
  const title = String(event?.title || '').trim().slice(0, 100);
  const type = String(event?.type || 'Wedding');
  const date = String(event?.date || '');
  const guests = Number(event?.guests);
  const budget = Number(event?.budget);
  if (!title) throw new Error('Add an event name first.');
  if (!['Wedding', 'Birthday', 'Community event'].includes(type)) throw new Error('Choose a supported event type.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`))) throw new Error('Choose a valid event date.');
  if (!Number.isInteger(guests) || guests < 1 || guests > 5000) throw new Error('Guest count must be between 1 and 5,000.');
  if (!Number.isInteger(budget) || budget < 1 || budget > 100_000_000) throw new Error('Enter a whole-number budget.');
  const currency = String(event?.currency || 'USD');
  if (!['USD', 'INR', 'GBP', 'EUR'].includes(currency)) throw new Error('Choose a supported currency.');
  return { title, type, date, guests, budget, currency, location: String(event?.location || '').trim().slice(0, 120), preferences: String(event?.preferences || '').trim().slice(0, 1200) };
}

function extractText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
}

async function askOpenAI({ input, schemaName }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const error = new Error('AI is not configured on the EventCraft server yet. Add OPENAI_API_KEY to its environment or Secret Manager.');
    error.status = 503;
    throw error;
  }
  const body = { model: process.env.OPENAI_MODEL || 'gpt-6-luna', input, store: false };
  if (schemaName) body.text = { format: { type: 'json_schema', name: schemaName, strict: true, schema: planSchema } };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'The OpenAI API key was rejected. Check the server secret.' : response.status === 429 ? 'The AI service is busy or the API account has reached its limit. Try again shortly.' : `AI request failed (${response.status}). Check the server output and try again.`);
    error.status = response.status === 401 ? 401 : response.status === 429 ? 429 : 502;
    console.error('OpenAI API error:', data.error?.message || response.statusText);
    throw error;
  }
  if (data.status === 'incomplete') {
    const error = new Error('The AI response was cut short. Please try again.'); error.status = 502; throw error;
  }
  const text = extractText(data);
  if (!text) { const error = new Error('The AI returned an empty response. Please try again.'); error.status = 502; throw error; }
  return schemaName ? JSON.parse(text) : text;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    setSecurityHeaders(res);
    if (url.pathname.startsWith('/api/')) allowAppOrigin(req, res);
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const ai = Boolean(process.env.OPENAI_API_KEY);
      return json(res, ai ? 200 : 503, { ready: ai, ai });
    }
    if (req.method === 'POST' && url.pathname === '/api/plan') {
      enforceRateLimit(`${req.socket.remoteAddress}:plan`, 12, 15 * 60_000);
      const event = validateEvent(await readBody(req));
      const plan = await askOpenAI({ schemaName: 'eventcraft_plan', input: [
        { role: 'system', content: 'You are EventCraft AI, a careful event-planning assistant. Create practical, personalized plans for weddings, birthdays, and community events. Use the exact supplied event date and local context. All budget line amounts must be nonnegative whole numbers and sum exactly to the supplied budget. Timeline dueDate values must be YYYY-MM-DD and on or before the event date. Create useful, realistically spaced planning tasks, vendor questions, and distinctive ideas based on preferences. Never claim to have verified local prices or vendor availability. All amounts use the currency supplied by the user.' },
        { role: 'user', content: JSON.stringify(event) }
      ] });
      const eventDay = new Date(`${event.date}T12:00:00`);
      for (const task of plan.timeline) {
        const dueDay = new Date(`${task.dueDate}T12:00:00`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || Number.isNaN(dueDay.getTime()) || dueDay > eventDay) {
          const error = new Error('The AI returned a timeline date after your event. Please generate the plan again.'); error.status = 502; throw error;
        }
      }
      const sum = plan.budgetBreakdown.reduce((n, row) => n + Math.max(0, Math.round(Number(row.amount) || 0)), 0);
      if (!plan.budgetBreakdown.length || !plan.timeline.length || !plan.vendorChecklist.length || !plan.ideas.length) throw new Error('The AI plan was incomplete. Please generate it again.');
      if (sum !== event.budget) {
        const rows = plan.budgetBreakdown;
        const rawSum = rows.reduce((n, row) => n + Math.max(0, Number(row.amount) || 0), 0) || 1;
        let allocated = 0;
        rows.forEach((row, index) => {
          row.amount = index === rows.length - 1 ? event.budget - allocated : Math.round(event.budget * Math.max(0, Number(row.amount) || 0) / rawSum);
          allocated += row.amount;
        });
      }
      return json(res, 200, { plan });
    }
    if (req.method === 'POST' && url.pathname === '/api/assistant') {
      enforceRateLimit(`${req.socket.remoteAddress}:assistant`, 30, 15 * 60_000);
      const body = await readBody(req);
      const message = String(body.message || '').trim().slice(0, 2500);
      if (!message) return json(res, 400, { error: 'Type a question first.' });
      const history = Array.isArray(body.history) ? body.history.slice(-8).map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content || '').slice(0, 2500) })) : [];
      const key = process.env.OPENAI_API_KEY;
      if (!key) { const error = new Error('AI is not configured yet. Add OPENAI_API_KEY to your local .env file, then restart EventCraft.'); error.status = 503; throw error; }
      const instructions = 'You are EventCraft AI, a warm, practical event-planning assistant. Help with weddings, birthdays, and community events. Use the supplied task list and active event as the source of truth. If user asks you to add, edit, complete, or delete a task, call the matching function. If the user asks to create a plan/event, call add_event and then explain the plan will be generated. If they ask to update the event, call update_event. Use navigate_calendar for explicit requests to open a date or view. Never claim a change happened unless you called a tool. For advice, keep it actionable and concise. Cost figures are estimates. You have no live hotel/vendor inventory; do not invent business names or current prices. For hotel or vendor requests, explain that this demo has no live listings and never present sample names, prices, or availability as real. Ask for a city if local context would help.';
      const context = JSON.stringify({ activeEvent: body.event || null, tasks: (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 80), calendar: body.calendar || null, message });
      let input = [...history, { role: 'user', content: context }], actions = [], answer = '';
      for (let turn = 0; turn < 4; turn++) {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-6-luna', instructions, input, tools: assistantTools, tool_choice: 'auto', store: false }),
          signal: AbortSignal.timeout(60_000)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(response.status === 401 ? 'The OpenAI API key was rejected. Check the server secret.' : response.status === 429 ? 'The AI service is busy or the API account has reached its limit. Try again shortly.' : `AI request failed (${response.status}).`);
          error.status = response.status === 401 ? 401 : response.status === 429 ? 429 : 502;
          console.error('OpenAI API error:', data.error?.message || response.statusText); throw error;
        }
        if (data.status === 'incomplete') { const error = new Error('The AI response was cut short. Please try again.'); error.status = 502; throw error; }
        const calls = (data.output || []).filter(item => item.type === 'function_call' && assistantTools.some(tool => tool.name === item.name));
        if (!calls.length) { answer = extractText(data); break; }
        actions.push(...calls.map(call => ({ name: call.name, args: JSON.parse(call.arguments || '{}') })));
        input = [...input, ...(data.output || []), ...calls.map(call => ({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ accepted: true, note: 'This action is prepared for the app to apply locally.' }) }))];
      }
      return json(res, 200, { answer: answer || 'I prepared the requested changes for your calendar.', actions });
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const content = await readFile(join(root, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(content);
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    const status = error.status || 400;
    if (status >= 500) console.error(error.message);
    return json(res, status, { error: error.message || 'Something went wrong.' });
  }
});

const host = process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1';
server.listen(port, host, () => console.log(`EventCraft is listening at http://${host}:${port}`));
