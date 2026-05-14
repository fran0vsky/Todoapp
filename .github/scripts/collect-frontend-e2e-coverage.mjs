import { chromium } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.env.BASE_URL;
const outputRoot =
  process.env.COVERAGE_OUTPUT_DIR || 'reports/e2e/coverage-html';
const authStatePath =
  process.env.PLAYWRIGHT_AUTH_STATE || 'todo-e2e/.auth/user.json';

if (!baseUrl) {
  console.error('BASE_URL is required for frontend coverage collection.');
  process.exit(1);
}

const hasAuthState = await fileExists(authStatePath);

const scenarios = [
  { id: 'public-home', relativePath: '/', storageState: undefined },
  ...(hasAuthState
    ? [
        {
          id: 'auth-board',
          relativePath: '/projects',
          storageState: authStatePath,
        },
      ]
    : []),
];

const runResults = [];

for (const scenario of scenarios) {
  try {
    const result = await collectScenarioCoverage(scenario);
    runResults.push({ ...result, status: 'ok' });
  } catch (error) {
    runResults.push({
      id: scenario.id,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      entries: [],
      totals: { scripts: 0, totalBytes: 0, usedBytes: 0, percentUsed: 0 },
    });
  }
}

const mergedEntries = mergeEntries(
  runResults.flatMap((result) => result.entries),
);
const overallTotals = computeTotals(mergedEntries);

await mkdir(outputRoot, { recursive: true });
await writeFile(
  join(outputRoot, 'coverage-summary.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl,
      scenarios: runResults,
      overall: {
        totals: overallTotals,
        entryCount: mergedEntries.length,
      },
      note: 'Frontend runtime coverage sampled via Chromium DevTools Profiler during post-deploy E2E job.',
    },
    null,
    2,
  ),
  'utf8',
);

await writeFile(
  join(outputRoot, 'index.html'),
  renderCoverageHtml(baseUrl, runResults, mergedEntries, overallTotals),
  'utf8',
);

console.log(
  `Frontend coverage report generated at ${join(outputRoot, 'index.html')}`,
);

async function fileExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveAppUrl(base, relative) {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = relative.replace(/^\//, '');
  return `${normalizedBase}${normalizedPath}`;
}

async function collectScenarioCoverage({ id, relativePath, storageState }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    storageState ? { storageState } : undefined,
  );
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Profiler.enable');
  await cdpSession.send('Debugger.enable');
  await cdpSession.send('Profiler.startPreciseCoverage', {
    callCount: false,
    detailed: true,
  });

  const targetUrl = resolveAppUrl(baseUrl, relativePath);
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const result = await cdpSession.send('Profiler.takePreciseCoverage');
  await cdpSession.send('Profiler.stopPreciseCoverage');
  await cdpSession.send('Profiler.disable');
  await cdpSession.send('Debugger.disable');
  await browser.close();

  const entries = (result.result || [])
    .filter((entry) => shouldIncludeEntry(entry.url))
    .map((entry) => {
      const { totalBytes, usedBytes } = getUsedAndTotalBytes(
        entry.functions || [],
      );
      return {
        url: entry.url,
        totalBytes,
        usedBytes,
        percentUsed: percentage(usedBytes, totalBytes),
      };
    });

  const totals = computeTotals(entries);

  return {
    id,
    status: 'ok',
    visitedUrl: targetUrl,
    entries,
    totals,
  };
}

function shouldIncludeEntry(url) {
  if (!url) return false;
  return url.startsWith(baseUrl);
}

function getUsedAndTotalBytes(functions) {
  let totalBytes = 0;
  const usedRanges = [];

  for (const fn of functions) {
    for (const range of fn.ranges || []) {
      const start = Number(range.startOffset) || 0;
      const end = Number(range.endOffset) || 0;
      if (end <= start) continue;
      totalBytes += end - start;
      if ((Number(range.count) || 0) > 0) {
        usedRanges.push([start, end]);
      }
    }
  }

  const usedBytes = sumMergedRanges(usedRanges);
  return { totalBytes, usedBytes };
}

function sumMergedRanges(ranges) {
  if (!ranges.length) return 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged.reduce((sum, [start, end]) => sum + (end - start), 0);
}

function mergeEntries(entries) {
  const byUrl = new Map();
  for (const entry of entries) {
    const current = byUrl.get(entry.url);
    if (!current) {
      byUrl.set(entry.url, { ...entry });
      continue;
    }
    current.totalBytes = Math.max(current.totalBytes, entry.totalBytes);
    current.usedBytes = Math.max(current.usedBytes, entry.usedBytes);
    current.percentUsed = percentage(current.usedBytes, current.totalBytes);
  }
  return [...byUrl.values()].sort((a, b) => b.percentUsed - a.percentUsed);
}

function computeTotals(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.scripts += 1;
      acc.totalBytes += entry.totalBytes;
      acc.usedBytes += entry.usedBytes;
      return acc;
    },
    { scripts: 0, totalBytes: 0, usedBytes: 0, percentUsed: 0 },
  );
  totals.percentUsed = percentage(totals.usedBytes, totals.totalBytes);
  return totals;
}

function percentage(used, total) {
  if (!total) return 0;
  return Number(((used / total) * 100).toFixed(2));
}

function renderCoverageHtml(targetBaseUrl, scenarioResults, entries, totals) {
  const scenarioRows = scenarioResults
    .map((scenario) => {
      if (scenario.status !== 'ok') {
        return `<tr><td>${escapeHtml(scenario.id)}</td><td colspan="4">Error: ${escapeHtml(
          scenario.error || 'Unknown error',
        )}</td></tr>`;
      }
      return `<tr><td>${escapeHtml(scenario.id)}</td><td>${escapeHtml(
        scenario.visitedUrl || '',
      )}</td><td>${scenario.totals.scripts}</td><td>${scenario.totals.percentUsed}%</td><td>${formatBytes(
        scenario.totals.usedBytes,
      )} / ${formatBytes(scenario.totals.totalBytes)}</td></tr>`;
    })
    .join('\n');

  const scriptRows = entries
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.url)}</td><td>${entry.percentUsed}%</td><td>${formatBytes(
          entry.usedBytes,
        )}</td><td>${formatBytes(entry.totalBytes)}</td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Frontend E2E Coverage</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1, h2 { margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f2f2f2; }
    .meta { margin-bottom: 16px; color: #444; }
  </style>
</head>
<body>
  <h1>Frontend runtime coverage (E2E job)</h1>
  <div class="meta">Base URL: ${escapeHtml(targetBaseUrl)}</div>
  <div class="meta">Generated: ${new Date().toISOString()}</div>
  <h2>Overall</h2>
  <table>
    <thead>
      <tr><th>Scripts</th><th>Coverage</th><th>Used bytes</th><th>Total bytes</th></tr>
    </thead>
    <tbody>
      <tr><td>${totals.scripts}</td><td>${totals.percentUsed}%</td><td>${formatBytes(
        totals.usedBytes,
      )}</td><td>${formatBytes(totals.totalBytes)}</td></tr>
    </tbody>
  </table>

  <h2>Scenarios</h2>
  <table>
    <thead>
      <tr><th>Scenario</th><th>Visited URL</th><th>Scripts</th><th>Coverage</th><th>Used / Total</th></tr>
    </thead>
    <tbody>
      ${scenarioRows || '<tr><td colspan="5">No scenarios were executed.</td></tr>'}
    </tbody>
  </table>

  <h2>Scripts</h2>
  <table>
    <thead>
      <tr><th>Script URL</th><th>Coverage</th><th>Used bytes</th><th>Total bytes</th></tr>
    </thead>
    <tbody>
      ${scriptRows || '<tr><td colspan="4">No script coverage entries were collected.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

function formatBytes(value) {
  if (!value) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
