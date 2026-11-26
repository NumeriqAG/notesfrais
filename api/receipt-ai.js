const { Anthropic } = require('@anthropic-ai/sdk');
const { sendJson, readJson, methodNotAllowed } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { CURRENCIES } = require('./_lib/fx');

// Lecture d'un recu par IA (nov. 2026).
//
//   POST /api/receipt-ai  { data: <base64 sans prefixe>, media_type, today? }
//   -> { ok, fields: { merchant, total, vat, currency, date, category } }
//
// Tesseract, dans le navigateur, lisait mal les tickets froisses, en biais ou
// a l'encre pale. La photo (deja compressee par l'app, 1800 px de cote au
// plus) part ici, puis a l'API Claude, qui renvoie les champs du formulaire
// dans un JSON contraint par un schema. Rien n'est stocke : ni la photo ni la
// reponse ne passent par la base ou par R2 sur ce chemin. Le justificatif est
// televerse plus tard, a l'enregistrement, par /api/receipts comme avant.
//
// L'app garde Tesseract en secours : hors ligne, sans cle API configuree, ou
// si cette route echoue, la lecture repasse sur le telephone.
//
// Confidentialite : la photo du recu est transmise a Anthropic (fournisseur du
// modele). Elle n'est pas utilisee pour entrainer les modeles.
//
// Variables : ANTHROPIC_API_KEY (obligatoire), RECEIPT_AI_MODEL (facultatif,
// defaut claude-opus-5-5 ; claude-haiku-5-5 coute environ 40 fois moins).
//
// Droits : toute session valide (user ou finance). La route ne lit ni n'ecrit
// aucune donnee d'un canal, il n'y a donc pas de controle de canal a refaire.

const DEFAULT_MODEL = 'claude-opus-5-5';
// Les modeles qui acceptent le repli cote serveur en cas de refus.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-fable-5-2']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PDF_TYPE = 'application/pdf';
// Vercel refuse un corps de plus de 4,5 Mo ; en base64, 4 Mo de texte font
// environ 3 Mo de fichier.
const MAX_BASE64 = 4 * 1024 * 1024;
const CATEGORIES = ['repas', 'transport', 'hotel', 'materiel', 'autre'];

const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean' },
    merchant: nullable({ type: 'string' }),
    total: nullable({ type: 'number' }),
    vat: nullable({ type: 'number' }),
    currency: nullable({ type: 'string' }),
    date: nullable({ type: 'string' }),
    category: { type: 'string', enum: CATEGORIES }
  },
  required: ['is_receipt', 'merchant', 'total', 'vat', 'currency', 'date', 'category'],
  additionalProperties: false
};

const SYSTEM = `You read photos and PDFs of receipts and invoices for the expense app of a Swiss company (Numeriq AG, Geneva). The employee mostly pays in CHF, sometimes abroad in EUR, GBP, USD or other currencies.

Return the fields of the expense form:
- is_receipt: false if the document is not a receipt or invoice, or is unreadable. Then set the other fields to null and category to "autre".
- merchant: the business name as a person would write it (for example "Coop Pronto", "Hotel Bristol", "SBB CFF FFS"). Not the legal form alone, not the address, not the payment terminal provider.
- total: the final amount actually paid, taxes and tip included, as a number with a dot for decimals. Swiss receipts write thousands with an apostrophe (1'234.50). If several totals appear (subtotal, total, amount paid by card, change), take what the customer paid. Ignore the change returned.
- vat: the total VAT / MWST / TVA / IVA amount included in the total, in money, not the rate. If several VAT rates are listed, add their amounts. null if no VAT amount is printed.
- currency: ISO 4217 code of the total (CHF, EUR, GBP, USD...). "Fr.", "SFr." and "CHF" mean CHF. Use the country of the merchant when no currency is printed. null if you cannot tell.
- date: the transaction date as YYYY-MM-DD. Swiss and European receipts write day before month (05.11.26 is 5 November 2026). null if none is printed.
- category: "repas" for restaurants, cafes, bars, food and drinks; "transport" for trains, taxis, Uber, flights, fuel, parking, tolls, car rental; "hotel" for lodging; "materiel" for equipment, electronics, office supplies, software; "autre" for anything else.

Copy what is printed. Do not guess a value that is not on the document: use null.`;

let client;
function anthropic() {
  if (!client) client = new Anthropic({ timeout: 45 * 1000, maxRetries: 1 });
  return client;
}

module.exports = async function handler(req, res) {
  try {
    requireSession(req);
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!process.env.ANTHROPIC_API_KEY) {
      return sendJson(res, 503, { ok: false, error: 'AI reading is not configured (ANTHROPIC_API_KEY missing)' });
    }
    const body = await readJson(req);
    const mediaType = String(body.media_type || '').toLowerCase();
    const data = String(body.data || '').replace(/^data:[^,]*,/, '');
    if (!data) return sendJson(res, 400, { ok: false, error: 'No file' });
    if (data.length > MAX_BASE64) return sendJson(res, 413, { ok: false, error: 'File too large for AI reading' });
    if (!/^[A-Za-z0-9+/]+=*$/.test(data)) return sendJson(res, 400, { ok: false, error: 'File is not base64' });

    let source;
    if (IMAGE_TYPES.has(mediaType)) {
      source = { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
    } else if (mediaType === PDF_TYPE) {
      source = { type: 'document', source: { type: 'base64', media_type: PDF_TYPE, data } };
    } else {
      return sendJson(res, 415, { ok: false, error: 'Unsupported file type: ' + (mediaType || 'unknown') });
    }

    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? body.today : new Date().toISOString().slice(0, 10);
    const model = String(process.env.RECEIPT_AI_MODEL || DEFAULT_MODEL).trim();
    const params = {
      model,
      max_tokens: 4096,
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [source, { type: 'text', text: `Today is ${today}. Read this receipt.` }]
      }]
    };
    if (FALLBACK_MODELS.has(model)) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }

    const started = Date.now();
    const message = await anthropic().beta.messages.create(params);
    if (message.stop_reason === 'refusal') {
      return sendJson(res, 422, { ok: false, error: 'The AI declined to read this document' });
    }
    if (message.stop_reason === 'max_tokens') {
      return sendJson(res, 502, { ok: false, error: 'AI answer was cut off' });
    }
    const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (_error) {
      return sendJson(res, 502, { ok: false, error: 'AI answer was not valid JSON' });
    }
    const fields = cleanFields(raw);
    return sendJson(res, 200, {
      ok: true,
      fields,
      model: message.model,
      ms: Date.now() - started,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens }
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return sendJson(res, 503, { ok: false, error: 'AI reading: the API key was refused' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return sendJson(res, 429, { ok: false, error: 'AI reading: rate limited, try again' });
    }
    if (error instanceof Anthropic.APIError) {
      return sendJson(res, 502, { ok: false, error: 'AI reading failed (' + (error.status || 'network') + ')' });
    }
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

// Le schema garantit la forme ; les valeurs, elles, sont reverifiees ici
// avant d'atteindre le formulaire.
function cleanFields(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const money = value => {
    const n = typeof value === 'number' ? value : parseFloat(String(value == null ? '' : value).replace(/['\s]/g, ''));
    return Number.isFinite(n) && n > 0 && n < 1000000 ? Math.round(n * 100) / 100 : null;
  };
  const total = money(r.total);
  let vat = money(r.vat);
  if (vat !== null && total !== null && vat >= total) vat = null;
  const currency = String(r.currency || '').trim().toUpperCase();
  let date = String(r.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T00:00:00Z').getTime())) date = null;
  const merchant = String(r.merchant || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
  return {
    is_receipt: r.is_receipt !== false,
    merchant,
    total,
    vat,
    currency: CURRENCIES.includes(currency) ? currency : null,
    date,
    category: CATEGORIES.includes(r.category) ? r.category : null
  };
}

module.exports.cleanFields = cleanFields;
module.exports.SCHEMA = SCHEMA;
