import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import got from 'got';
import pLimit from 'p-limit';
import { fileURLToPath } from 'node:url';

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../../..');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface Row {
  [key: string]: string;
}

function getPdfUrlColumns(header: string[]): string[] {
  // Heuristic: columns named like "Policy X Wording Path" contain URLs
  return header.filter((h) => /Wording Path/i.test(h));
}

async function readCsv(filePath: string): Promise<{ header: string[]; rows: Row[] }> {
  const content = fs.readFileSync(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    let header: string[] = [];
    parse(content, { columns: true, relax_quotes: true, relax_column_count: true }, (err, records: Row[], info) => {
      if (err) return reject(err);
      // @ts-ignore internal
      header = info?.columns ?? Object.keys(records[0] ?? {});
      for (const r of records) rows.push(r);
      resolve({ header, rows });
    });
  });
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-z0-9\-_.]+/gi, '_').slice(0, 160);
}

function normalizeUrl(raw: string): string {
  try {
    // If already valid
    // eslint-disable-next-line no-new
    new URL(raw);
    return raw;
  } catch {
    return encodeURI(raw);
  }
}

async function downloadFile(url: string, outPath: string): Promise<void> {
  const tmp = `${outPath}.part`;
  if (fs.existsSync(outPath)) return;
  const stream = got.stream(normalizeUrl(url), { timeout: { request: 60000 } });
  await new Promise<void>((resolve, reject) => {
    const write = fs.createWriteStream(tmp);
    stream.on('error', reject);
    write.on('error', reject);
    write.on('finish', () => resolve());
    stream.pipe(write);
  });
  fs.renameSync(tmp, outPath);
}

async function main() {
  const root = getProjectRoot();
  const csvPath = path.join(root, 'data', 'fine-tuning-data.csv');
  const outDir = path.join(root, 'artifacts', 'pdf');
  ensureDir(outDir);

  const { header, rows } = await readCsv(csvPath);
  const urlCols = getPdfUrlColumns(header);
  const limit = pLimit(5);

  const tasks: Array<Promise<void>> = [];
  for (const row of rows) {
    for (const col of urlCols) {
      const url = (row[col] || '').trim();
      if (!url) continue;
      if (!/^https?:\/\//i.test(url)) continue;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        parsed = new URL(normalizeUrl(url));
      }
      const base = sanitizeFileName(path.basename(parsed.pathname));
      const out = path.join(outDir, base);
      tasks.push(limit(() => downloadFile(url, out)));
      break; // only one PDF per logical row/policy
    }
  }

  await Promise.all(tasks);
  console.log(`Downloaded PDFs to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
