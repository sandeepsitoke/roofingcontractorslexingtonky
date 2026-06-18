import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, pathExists, readJson, rootDir, uniqueValues, writeJson } from './utils.mjs';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_SITEMAP_SCOPE = 'https://www.googleapis.com/auth/webmasters';
const GOOGLE_INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const DEFAULT_SITE_URL = 'https://roofingcontractorslexingtonky.com';
const DEFAULT_SITEMAP_URL = 'https://roofingcontractorslexingtonky.com/sitemap-0.xml';
const STATE_PATH = 'content-engine/indexing-state.json';
const REPORT_PATH = 'content-engine/indexing-report.json';
const CONTENT_STATE_PATH = 'content-engine/state.json';

await loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const mode = args.autopilot ? 'autopilot' : args.inspect ? 'inspect' : args['google-indexing'] ? 'google-indexing' : 'submit';
const force = Boolean(args.force);
const dryRun = Boolean(args['dry-run']);
const latest = Boolean(args.latest);
const urls = normalizeUrls(await resolveUrls(args, latest));

if (urls.length === 0) {
  console.log('No URLs selected for indexing.');
  process.exit(0);
}

const state = await readIndexingState();

if (mode === 'autopilot') {
  await runAutopilot(urls, state, { force: true, dryRun });
} else if (mode === 'inspect') {
  await inspectUrls(urls, state);
} else if (mode === 'google-indexing') {
  for (const url of urls) ensureUrlRecord(state, url);
  await submitGoogleIndexingApi(urls, state, { dryRun });
} else {
  await submitUrls(urls, state, { force, dryRun });
}

await writeJson(STATE_PATH, state);

async function runAutopilot(selectedUrls, stateValue, options) {
  console.log(`Indexing autopilot selected ${selectedUrls.length} sitemap URL(s).`);
  for (const url of selectedUrls) ensureUrlRecord(stateValue, url);

  const liveResults = await liveTestUrls(selectedUrls, stateValue, options);
  const liveOkUrls = selectedUrls.filter(url => liveResults.get(url)?.status === 'live-ok');
  const blockedUrls = selectedUrls.filter(url => liveResults.get(url)?.status !== 'live-ok');

  if (blockedUrls.length > 0) {
    console.warn(`Autopilot blocked ${blockedUrls.length} URL(s) because live tests did not pass.`);
  }

  if (liveOkUrls.length === 0) {
    console.warn('Autopilot stopped: no URLs passed the live test.');
    await writeIndexingReport(stateValue, selectedUrls, {
      mode: 'autopilot',
      submittedUrls: [],
      blockedUrls,
    });
    return;
  }

  await submitUrls(liveOkUrls, stateValue, options);
  await writeIndexingReport(stateValue, selectedUrls, {
    mode: 'autopilot',
    submittedUrls: liveOkUrls,
    blockedUrls,
  });
}

async function liveTestUrls(selectedUrls, stateValue, options = {}) {
  const results = new Map();
  const concurrency = Math.max(1, Number(process.env.INDEXING_LIVE_CONCURRENCY || 4));
  for (let index = 0; index < selectedUrls.length; index += concurrency) {
    const batch = selectedUrls.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map(url => liveTestUrl(url, stateValue, options)));
    for (const result of batchResults) {
      results.set(result.url, result);
    }
  }
  return results;
}

async function liveTestUrl(url, stateValue, options = {}) {
  ensureUrlRecord(stateValue, url);
  const startedAt = Date.now();

  if (options.dryRun) {
    const result = {
      url,
      status: 'live-ok',
      dryRun: true,
      checkedAt: new Date().toISOString(),
      responseCode: null,
    };
    stateValue.urls[url].liveTest = result;
    console.log(`Live test dry-run for ${url}.`);
    return result;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(Number(process.env.INDEXING_LIVE_TIMEOUT_MS || 20000)),
      headers: {
        'user-agent': 'Mozilla/5.0 compatible; LeadGenIndexingBot/1.0; +https://roofingcontractorslexingtonky.com/llms.txt',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const html = contentType.includes('text/html') ? await response.text() : '';
    const robotsNoIndex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)
      || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(html);
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || null;
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
    const ok = response.ok && !robotsNoIndex;
    const result = {
      url,
      status: ok ? 'live-ok' : 'blocked',
      checkedAt: new Date().toISOString(),
      responseCode: response.status,
      finalUrl: response.url,
      contentType,
      contentLength: Number(response.headers.get('content-length')) || null,
      durationMs: Date.now() - startedAt,
      robotsNoIndex,
      canonical,
      title,
    };
    stateValue.urls[url].liveTest = result;
    console.log(`Live test ${result.status} ${response.status} for ${url}.`);
    return result;
  } catch (error) {
    const result = {
      url,
      status: 'failed',
      checkedAt: new Date().toISOString(),
      error: error.message,
      durationMs: Date.now() - startedAt,
    };
    stateValue.urls[url].liveTest = result;
    markUrlError(stateValue, url, 'liveTest', error.message);
    console.warn(`Live test failed for ${url}: ${error.message}`);
    return result;
  }
}

async function submitUrls(selectedUrls, stateValue, options) {
  const pendingUrls = options.force
    ? selectedUrls
    : selectedUrls.filter(url => {
      const status = stateValue.urls[url]?.indexNow?.status;
      return status !== 'accepted' && status !== 'submitted';
    });

  if (pendingUrls.length === 0) {
    console.log('Selected URLs were already submitted. Use --force to resubmit.');
    return;
  }

  for (const url of pendingUrls) {
    ensureUrlRecord(stateValue, url);
  }

  await submitIndexNow(pendingUrls, stateValue, options);
  await submitGoogleSitemap(pendingUrls, stateValue, options);
  await submitGoogleAggressive(pendingUrls, stateValue, options);
  await inspectUrls(pendingUrls, stateValue, { optional: true });
}

async function submitIndexNow(selectedUrls, stateValue, options) {
  const config = await resolveIndexNowConfig();
  if (!config.key || !config.keyLocation) {
    markBatchError(stateValue, selectedUrls, 'indexNow', 'INDEXNOW_KEY or key file is missing.');
    console.warn('IndexNow skipped: INDEXNOW_KEY or key file is missing.');
    return;
  }

  const keyFileOk = await verifyIndexNowKeyLocation(config, { allowLocal: options.dryRun });
  if (!keyFileOk && !options.dryRun) {
    markBatchError(stateValue, selectedUrls, 'indexNow', `Key location did not verify: ${config.keyLocation}`);
    console.warn(`IndexNow skipped: key location did not verify at ${config.keyLocation}`);
    return;
  }

  const batches = chunk(selectedUrls, 10000);
  for (const batch of batches) {
    const payload = {
      host: config.host,
      key: config.key,
      keyLocation: config.keyLocation,
      urlList: batch,
    };

    if (options.dryRun) {
      console.log(JSON.stringify({ provider: 'indexnow', endpoint: INDEXNOW_ENDPOINT, payload }, null, 2));
      markBatchStatus(stateValue, batch, 'indexNow', {
        status: 'dry-run',
        submittedAt: new Date().toISOString(),
        endpoint: INDEXNOW_ENDPOINT,
        responseCode: null,
      });
      continue;
    }

    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      const accepted = response.status === 200 || response.status === 202;
      const retryable = response.status === 429 || response.status >= 500;
      markBatchStatus(stateValue, batch, 'indexNow', {
        status: accepted ? 'accepted' : retryable ? 'retry-later' : 'failed',
        submittedAt: new Date().toISOString(),
        endpoint: INDEXNOW_ENDPOINT,
        responseCode: response.status,
        responseText: responseText.slice(0, 500),
      });
      console.log(`IndexNow ${accepted ? 'accepted' : 'returned'} ${response.status} for ${batch.length} URL(s).`);
    } catch (error) {
      markBatchError(stateValue, batch, 'indexNow', error.message);
      console.warn(`IndexNow failed: ${error.message}`);
    }
  }
}

async function submitGoogleSitemap(selectedUrls, stateValue, options) {
  const siteUrl = process.env.GOOGLE_SITE_URL || `${DEFAULT_SITE_URL}/`;
  const sitemapUrl = process.env.GOOGLE_SITEMAP_URL || DEFAULT_SITEMAP_URL;

  const token = await getGoogleAccessToken(GOOGLE_SITEMAP_SCOPE);
  if (!token) {
    markBatchStatus(stateValue, selectedUrls, 'googleSitemap', {
      status: 'skipped',
      submittedAt: new Date().toISOString(),
      reason: 'Google service-account credentials are not configured.',
    });
    console.log(`Google sitemap submit skipped. Manual fallback: submit ${sitemapUrl} in Search Console.`);
    return;
  }

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  if (options.dryRun) {
    console.log(JSON.stringify({ provider: 'google-sitemap', endpoint, method: 'PUT' }, null, 2));
    markBatchStatus(stateValue, selectedUrls, 'googleSitemap', {
      status: 'dry-run',
      submittedAt: new Date().toISOString(),
      sitemapUrl,
    });
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    });
    const responseText = await response.text();
    markBatchStatus(stateValue, selectedUrls, 'googleSitemap', {
      status: response.ok ? 'submitted' : 'failed',
      submittedAt: new Date().toISOString(),
      sitemapUrl,
      responseCode: response.status,
      responseText: responseText.slice(0, 500),
    });
    console.log(`Google sitemap submit returned ${response.status}.`);
  } catch (error) {
    markBatchError(stateValue, selectedUrls, 'googleSitemap', error.message);
    console.warn(`Google sitemap submit failed: ${error.message}`);
  }
}

async function submitGoogleAggressive(selectedUrls, stateValue, options) {
  if (process.env.GOOGLE_AGGRESSIVE_INDEXING !== 'true') {
    markBatchStatus(stateValue, selectedUrls, 'googleAggressiveIndexing', {
      status: 'skipped',
      submittedAt: new Date().toISOString(),
      reason: 'GOOGLE_AGGRESSIVE_INDEXING is not true. Google officially limits this API to JobPosting and livestream BroadcastEvent URLs.',
    });
    return;
  }

  await submitGoogleIndexingApi(selectedUrls, stateValue, options);
}

async function submitGoogleIndexingApi(selectedUrls, stateValue, options) {
  for (const url of selectedUrls) {
    ensureUrlRecord(stateValue, url);
    const endpoint = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
    const payload = { url, type: process.env.GOOGLE_INDEXING_TYPE || 'URL_UPDATED' };
    if (options.dryRun) {
      console.log(JSON.stringify({ provider: 'google-indexing-api', endpoint, payload }, null, 2));
      stateValue.urls[url].googleAggressiveIndexing = {
        status: 'dry-run',
        submittedAt: new Date().toISOString(),
      };
    }
  }

  if (options.dryRun) return;

  const token = await getGoogleAccessToken(GOOGLE_INDEXING_SCOPE);
  if (!token) {
    markBatchStatus(stateValue, selectedUrls, 'googleAggressiveIndexing', {
      status: 'skipped',
      submittedAt: new Date().toISOString(),
      reason: 'Google Indexing API credentials are not configured.',
    });
    return;
  }

  for (const url of selectedUrls) {
    const endpoint = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
    const payload = { url, type: process.env.GOOGLE_INDEXING_TYPE || 'URL_UPDATED' };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      stateValue.urls[url].googleAggressiveIndexing = {
        status: response.ok ? 'submitted' : 'failed',
        submittedAt: new Date().toISOString(),
        endpoint,
        requestType: payload.type,
        responseCode: response.status,
        responseText: responseText.slice(0, 1000),
      };
      console.log(`Google Indexing API returned ${response.status} for ${url}.`);
    } catch (error) {
      markUrlError(stateValue, url, 'googleAggressiveIndexing', error.message);
      console.warn(`Google Indexing API failed for ${url}: ${error.message}`);
    }
  }
}

async function inspectUrls(selectedUrls, stateValue, options = {}) {
  const token = await getGoogleAccessToken(GOOGLE_SITEMAP_SCOPE);
  if (!token) {
    const message = 'Google URL Inspection skipped: service-account credentials are not configured.';
    if (!options.optional) {
      console.log(message);
    }
    for (const url of selectedUrls) {
      ensureUrlRecord(stateValue, url);
      stateValue.urls[url].googleInspection = {
        status: 'skipped',
        lastInspectionAt: new Date().toISOString(),
        reason: 'Google service-account credentials are not configured.',
      };
    }
    return;
  }

  const siteUrl = process.env.GOOGLE_SITE_URL || `${DEFAULT_SITE_URL}/`;
  for (const url of selectedUrls) {
    ensureUrlRecord(stateValue, url);
    try {
      const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ inspectionUrl: url, siteUrl }),
      });
      const responseText = await response.text();
      let parsed = null;
      try {
        parsed = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsed = null;
      }
      stateValue.urls[url].googleInspection = {
        status: response.ok ? 'inspected' : 'failed',
        lastInspectionAt: new Date().toISOString(),
        responseCode: response.status,
        verdict: parsed?.inspectionResult?.indexStatusResult?.verdict || null,
        coverageState: parsed?.inspectionResult?.indexStatusResult?.coverageState || null,
        indexingState: parsed?.inspectionResult?.indexStatusResult?.indexingState || null,
        raw: parsed || responseText.slice(0, 1000),
      };
      console.log(`Google URL Inspection returned ${response.status} for ${url}.`);
    } catch (error) {
      markUrlError(stateValue, url, 'googleInspection', error.message);
      console.warn(`Google URL Inspection failed for ${url}: ${error.message}`);
    }
  }
}

async function resolveUrls(parsedArgs, useLatest) {
  const explicit = collectUrlArgs(process.argv.slice(2));
  if (explicit.length > 0) {
    return explicit;
  }

  if (parsedArgs.sitemap || parsedArgs.autopilot) {
    return readUrlsFromSitemap(process.env.GOOGLE_SITEMAP_URL || DEFAULT_SITEMAP_URL);
  }

  if (useLatest || parsedArgs.latest) {
    const contentState = await readJson(CONTENT_STATE_PATH);
    return (contentState.generated || [])
      .filter(item => item.slug && item.publishStatus === 'publish-ready')
      .map(item => toSiteUrl(`/blog/${item.slug}/`));
  }

  return [];
}

async function writeIndexingReport(stateValue, selectedUrls, context) {
  const report = {
    ok: context.blockedUrls.length === 0,
    mode: context.mode,
    checkedAt: new Date().toISOString(),
    sitemapUrl: process.env.GOOGLE_SITEMAP_URL || DEFAULT_SITEMAP_URL,
    selectedCount: selectedUrls.length,
    submittedCount: context.submittedUrls.length,
    blockedCount: context.blockedUrls.length,
    urls: selectedUrls.map(url => {
      const record = stateValue.urls[url] || {};
      return {
        url,
        liveTest: summarizeLiveTest(record.liveTest),
        indexNow: summarizeProvider(record.indexNow),
        googleSitemap: summarizeProvider(record.googleSitemap),
        googleAggressiveIndexing: summarizeProvider(record.googleAggressiveIndexing),
        googleInspection: summarizeInspection(record.googleInspection),
      };
    }),
  };
  await writeJson(REPORT_PATH, report);
  console.log(`Indexing report written to ${REPORT_PATH}.`);
}

function summarizeLiveTest(value) {
  if (!value) return null;
  return {
    status: value.status,
    responseCode: value.responseCode || null,
    finalUrl: value.finalUrl || null,
    robotsNoIndex: Boolean(value.robotsNoIndex),
    canonical: value.canonical || null,
    durationMs: value.durationMs || null,
    checkedAt: value.checkedAt || null,
    error: value.error || null,
  };
}

function summarizeProvider(value) {
  if (!value) return null;
  return {
    status: value.status || null,
    responseCode: value.responseCode || null,
    submittedAt: value.submittedAt || null,
    requestType: value.requestType || null,
    reason: value.reason || null,
    error: value.error || null,
  };
}

function summarizeInspection(value) {
  if (!value) return null;
  return {
    status: value.status || null,
    responseCode: value.responseCode || null,
    verdict: value.verdict || null,
    coverageState: value.coverageState || null,
    indexingState: value.indexingState || null,
    lastInspectionAt: value.lastInspectionAt || null,
    reason: value.reason || null,
    error: value.error || null,
  };
}


async function readUrlsFromSitemap(sitemapUrl) {
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch sitemap ${sitemapUrl}: ${response.status}`);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
}

function collectUrlArgs(argv) {
  const urlsValue = [];
  const urlValue = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--url' && argv[i + 1]) {
      urlValue.push(argv[i + 1]);
      i += 1;
    } else if (token === '--urls') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        urlsValue.push(argv[i + 1]);
        i += 1;
      }
    }
  }
  return [...urlValue, ...urlsValue];
}

function normalizeUrls(values) {
  return uniqueValues(values.map(value => toSiteUrl(value))).filter(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  });
}

function toSiteUrl(value) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
  return `${siteUrl}/${String(value).replace(/^\/+/, '')}`;
}

async function resolveIndexNowConfig() {
  const host = process.env.SITE_HOST || new URL(process.env.SITE_URL || DEFAULT_SITE_URL).host;
  let key = process.env.INDEXNOW_KEY || '';
  let keyLocation = process.env.INDEXNOW_KEY_LOCATION || '';

  if (!key) {
    const inferred = await inferIndexNowKeyFromPublic();
    key = inferred?.key || '';
    keyLocation = inferred?.keyLocation || '';
  }

  if (key && !keyLocation) {
    keyLocation = `${(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')}/${key}.txt`;
  }

  return { host, key, keyLocation };
}

async function inferIndexNowKeyFromPublic() {
  const publicDir = path.join(rootDir, 'public');
  let entries = [];
  try {
    entries = await fs.readdir(publicDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.txt')) {
      continue;
    }
    const content = (await fs.readFile(path.join(publicDir, entry.name), 'utf8')).trim();
    if (/^[a-zA-Z0-9_-]{8,128}$/.test(content) && entry.name === `${content}.txt`) {
      return {
        key: content,
        keyLocation: `${(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')}/${entry.name}`,
      };
    }
  }
  return null;
}

async function verifyIndexNowKeyLocation(config, verifyOptions = {}) {
  const localPath = localPathForPublicUrl(config.keyLocation);
  if (verifyOptions.allowLocal && localPath && await pathExists(localPath)) {
    const content = (await fs.readFile(path.join(rootDir, localPath), 'utf8')).trim();
    return content === config.key;
  }

  try {
    const response = await fetch(config.keyLocation, { method: 'GET' });
    const text = await response.text();
    return response.ok && text.trim() === config.key;
  } catch {
    return false;
  }
}

function localPathForPublicUrl(keyLocation) {
  try {
    const url = new URL(keyLocation);
    const siteHost = process.env.SITE_HOST || new URL(process.env.SITE_URL || DEFAULT_SITE_URL).host;
    if (url.host !== siteHost) {
      return null;
    }
    return `public/${decodeURIComponent(url.pathname.replace(/^\/+/, ''))}`;
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(scope) {
  const serviceAccount = await readServiceAccount();
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope,
    aud: GOOGLE_TOKEN_ENDPOINT,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claimSet)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await response.json();
    if (!response.ok) {
      console.warn(`Google auth failed: ${payload.error_description || payload.error || response.status}`);
      return null;
    }
    return payload.access_token || null;
  } catch (error) {
    console.warn(`Google auth failed: ${error.message}`);
    return null;
  }
}

async function readServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      const maybePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      try {
        return JSON.parse(await fs.readFile(path.resolve(rootDir, maybePath), 'utf8'));
      } catch {
        return null;
      }
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      return JSON.parse(await fs.readFile(path.resolve(rootDir, process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8'));
    } catch {
      return null;
    }
  }

  return null;
}

async function readIndexingState() {
  if (!await pathExists(STATE_PATH)) {
    return { urls: {}, updatedAt: null };
  }
  const state = await readJson(STATE_PATH);
  return { urls: state.urls || {}, updatedAt: state.updatedAt || null };
}

function ensureUrlRecord(stateValue, url) {
  stateValue.urls[url] ||= {
    url,
    source: 'content-engine',
    firstSeenAt: new Date().toISOString(),
    retryCount: 0,
    errors: [],
  };
  stateValue.updatedAt = new Date().toISOString();
}

function markBatchStatus(stateValue, urlsToMark, provider, status) {
  for (const url of urlsToMark) {
    ensureUrlRecord(stateValue, url);
    stateValue.urls[url][provider] = status;
  }
}

function markBatchError(stateValue, urlsToMark, provider, message) {
  for (const url of urlsToMark) {
    markUrlError(stateValue, url, provider, message);
  }
}

function markUrlError(stateValue, url, provider, message) {
  ensureUrlRecord(stateValue, url);
  stateValue.urls[url][provider] = {
    status: 'failed',
    submittedAt: new Date().toISOString(),
    error: message,
  };
  stateValue.urls[url].retryCount = (stateValue.urls[url].retryCount || 0) + 1;
  stateValue.urls[url].errors ||= [];
  stateValue.urls[url].errors.push({
    provider,
    message,
    at: new Date().toISOString(),
  });
}

function chunk(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function base64UrlJson(value) {
  return base64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function loadLocalEnv() {
  const envPath = path.join(rootDir, '.env');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }
      const [rawKey, ...rawValueParts] = trimmed.split('=');
      const key = rawKey.trim();
      const rawValue = rawValueParts.join('=').trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      process.env[key] ||= value.replace(/\\n/g, '\n');
    }
  } catch {
    // .env is optional for local dry runs.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Top-level await has already performed the selected action.
}
