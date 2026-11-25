// Conversion des frais en devise etrangere vers le CHF.
//
// Mike saisit le montant du recu dans sa devise (EUR 148.00). Le serveur
// calcule aussitot une estimation en CHF au cours de la BCE du jour du frais,
// pour que les totaux du mois restent justes. Ce n'est qu'une estimation :
//
//  - le releve de carte donne le montant reellement debite (cours de la carte,
//    frais de change compris) ; le rapprochement l'enregistre avec la source
//    'card' ;
//  - la finance peut corriger le cours ou le montant CHF dans l'onglet
//    « Currencies » ; la source devient 'manual'.
//
// Une estimation ne remplace jamais une valeur 'card' ou 'manual', sauf si le
// montant, la devise ou la date du frais changent (la valeur ne correspond
// alors plus au frais).
//
// Les cours viennent de l'API publique Frankfurter (cours de reference de la
// BCE, sans cle). Ils sont gardes dans la table fx_rates : un cours de la BCE
// pour une date passee ne change plus.
const { sql } = require('./db');

// Devises publiees par la BCE, plus le CHF.
const CURRENCIES = [
  'CHF', 'EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN',
  'CZK', 'HUF', 'RON', 'BGN', 'ISK', 'TRY', 'CNY', 'HKD', 'SGD', 'KRW', 'INR',
  'IDR', 'THB', 'MYR', 'PHP', 'NZD', 'ZAR', 'MXN', 'BRL', 'ILS'
];
const FX_SOURCES = new Set(['ecb', 'card', 'manual', 'missing']);

function normalizeCurrency(value) {
  const code = String(value || 'CHF').trim().toUpperCase();
  return CURRENCIES.includes(code) ? code : 'CHF';
}

let tableReady;
async function ensureFxTable() {
  if (!tableReady) {
    tableReady = sql()`create table if not exists fx_rates (
      currency text not null,
      day date not null,
      rate numeric not null,
      rate_day date,
      fetched_at timestamptz not null default now(),
      primary key (currency, day)
    )`;
    tableReady.catch(() => { tableReady = null; });
  }
  await tableReady;
}

function isoDay(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Cours CHF pour 1 unite de `currency` au jour `day` (le dernier jour ouvre
// de la BCE si `day` tombe un week-end ou dans le futur).
async function fetchEcbRate(currency, day) {
  const today = new Date().toISOString().slice(0, 10);
  const when = day > today ? 'latest' : day;
  const urls = [
    `https://api.frankfurter.dev/v1/${when}?base=${currency}&symbols=CHF`,
    `https://api.frankfurter.app/${when}?from=${currency}&to=CHF`
  ];
  let lastError;
  for (const url of urls) {
    try {
      const data = await fetchJson(url, 4000);
      const rate = Number(data && data.rates && data.rates.CHF);
      if (Number.isFinite(rate) && rate > 0) return { rate, rateDay: isoDay(data.date || day) };
      lastError = new Error('no CHF rate in answer');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('rate unavailable');
}

async function ecbRate(currency, dayInput) {
  const code = normalizeCurrency(currency);
  if (code === 'CHF') return { rate: 1, rateDay: isoDay(dayInput) };
  const day = isoDay(dayInput);
  const today = new Date().toISOString().slice(0, 10);
  try {
    await ensureFxTable();
    const [cached] = await sql()`select rate, rate_day from fx_rates where currency = ${code} and day = ${day}`;
    if (cached) return { rate: Number(cached.rate), rateDay: isoDay(cached.rate_day || day) };
  } catch (_error) {
    // Pas de cache : on interroge quand meme la BCE.
  }
  const fresh = await fetchEcbRate(code, day);
  // Un cours « latest » pour une date future ou du jour peut encore bouger :
  // on ne le garde que pour les jours passes.
  if (day < today) {
    try {
      await sql()`insert into fx_rates (currency, day, rate, rate_day)
        values (${code}, ${day}, ${fresh.rate}, ${fresh.rateDay})
        on conflict (currency, day) do nothing`;
    } catch (_error) {
      // Le cache est un confort, pas une condition.
    }
  }
  return fresh;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

// Complete un frais a ecrire (POST) avec amount_chf / fx_rate / fx_source.
// N'echoue jamais : sans cours, le frais garde son montant d'origine comme
// estimation et la source 'missing' le signale a la finance.
async function withChfEstimate(item) {
  const currency = normalizeCurrency(item.currency);
  const amount = Number(item.amount || 0);
  if (currency === 'CHF') {
    return { ...item, currency, amount_chf: amount, fx_rate: null, fx_source: null, fx_date: null };
  }
  try {
    const { rate, rateDay } = await ecbRate(currency, item.date);
    return { ...item, currency, amount_chf: round2(amount * rate), fx_rate: rate, fx_source: 'ecb', fx_date: rateDay };
  } catch (_error) {
    return { ...item, currency, amount_chf: amount, fx_rate: null, fx_source: 'missing', fx_date: null };
  }
}

module.exports = { CURRENCIES, FX_SOURCES, normalizeCurrency, ecbRate, withChfEstimate, round2 };
