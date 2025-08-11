import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

interface CsvRow {
  [key: string]: string;
}

const TemplateRow = z.object({
  'Cover Name': z.string().optional(),
  'Section Name': z.string().optional(),
  'Feature Name': z.string().optional(),
  'Feature ID': z.string().optional(),
  'Point to Consider': z.string().optional(),
  'Policy Name': z.string().optional(),
  'Policy Code': z.string().optional(),
  'Policy Insurer': z.string().optional(),
  'Policy Wording Path': z.string().optional(),
  'Policy Content': z.string().optional(),
  'Policy Page': z.string().optional(),
});

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../../..');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function readCsv(filePath: string): Promise<CsvRow[]> {
  const content = fs.readFileSync(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    parse(content, { columns: true, relax_quotes: true, relax_column_count: true }, (err, records: CsvRow[]) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
}

function readAllTemplateRows(): string[] {
  const root = getProjectRoot();
  const tmplPath = path.join(root, 'template', 'question-template.csv');
  const csv = fs.readFileSync(tmplPath, 'utf8');
  const lines = csv.split(/\r?\n/);
  if (lines.length <= 1) return [];
  return lines.slice(1).filter(Boolean);
}

function normalizeSpaces(s?: string): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

function buildInstruction(): string {
  return [
    'You extract car insurance policy information from policy wordings (PDF text).',
    'Given: 1) the full policy text from one policy PDF, 2) a section template row with fields',
    'Return the template with the Policy Content summarized and mapped from the policy text.',
    'If field is absent, leave it empty. Prefer semantic matches over exact wording.',
  ].join(' ');
}

async function main() {
  const root = getProjectRoot();
  const dataCsv = path.join(root, 'data', 'fine-tuning-data.csv');
  const textDir = path.join(root, 'artifacts', 'text');
  const outDir = path.join(root, 'artifacts', 'train');
  ensureDir(outDir);

  const rows = await readCsv(dataCsv);
  const outPath = path.join(outDir, 'train.jsonl');
  const stream = fs.createWriteStream(outPath, 'utf8');
  const instruction = buildInstruction();

  for (const row of rows) {
    const parsed = TemplateRow.partial().safeParse(row);
    if (!parsed.success) continue;
    const url = row['Policy 1 Wording Path'] || row['Policy Wording Path'] || '';
    if (!url) continue;
    const filename = path.basename(new URL(url).pathname).replace(/\.pdf$/i, '.txt');
    const textPath = path.join(textDir, filename);
    if (!fs.existsSync(textPath)) continue;
    const policyText = fs.readFileSync(textPath, 'utf8');

    const inputTemplate = {
      'Cover Name': normalizeSpaces(row['Cover Name']),
      'Section Name': normalizeSpaces(row['Section Name']),
      'Feature Name': normalizeSpaces(row['Feature Name']),
      'Feature ID': normalizeSpaces(row['Feature ID']),
      'Point to Consider': normalizeSpaces(row['Point to Consider'] || row['Key Selling Feature']),
      'Policy Name': normalizeSpaces(row['Policy 1 Name'] || row['Policy Name']),
      'Policy Code': normalizeSpaces(row['Policy 1 Code'] || row['Policy Code']),
      'Policy Insurer': normalizeSpaces(row['Policy 1 Insurer'] || row['Policy Insurer']),
      'Policy Page': normalizeSpaces(row['Policy 1 Page'] || row['Policy Page']),
    };

    const outputTemplate = {
      ...inputTemplate,
      'Policy Content': normalizeSpaces(row['Policy 1 Content'] || row['Policy Content'] || ''),
    };

    const messages = [
      { role: 'system', content: instruction },
      { role: 'user', content: JSON.stringify({ policyText, template: inputTemplate }) },
      { role: 'assistant', content: JSON.stringify(outputTemplate) },
    ];

    stream.write(JSON.stringify({ messages }) + '\n');
  }

  stream.end();
  console.log(`Wrote training JSONL: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
