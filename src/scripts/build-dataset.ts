import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { fileURLToPath } from 'node:url';

interface CsvRow {
  [key: string]: string;
}

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

function pickTemplateFields(row: CsvRow): CsvRow {
  return {
    'Cover Name': row['Cover Name'],
    'Section Name': row['Section Name'],
    'Feature Name': row['Feature Name'],
    'Feature ID': row['Feature ID'],
    'Point to Consider': row['Point to Consider'] || row['Key Selling Feature'] || row['Point to Consider '],
  };
}

function pickPolicy(row: CsvRow): { name: string; code: string; insurer: string; url: string; content: string; page: string } {
  const url = row['Policy 1 Wording Path'] || row['Policy Wording Path'] || '';
  return {
    name: row['Policy 1 Name'] || row['Policy Name'] || '',
    code: row['Policy 1 Code'] || row['Policy Code'] || '',
    insurer: row['Policy 1 Insurer'] || row['Policy Insurer'] || '',
    url,
    content: row['Policy 1 Content'] || row['Policy Content'] || '',
    page: row['Policy 1 Page'] || row['Policy Page'] || '',
  };
}

async function main() {
  const root = getProjectRoot();
  const srcCsv = path.join(root, 'data', 'fine-tuning-data.csv');
  const outDir = path.join(root, 'artifacts', 'dataset');
  ensureDir(outDir);

  const rows = await readCsv(srcCsv);
  const outRows: CsvRow[] = [];
  for (const r of rows) {
    const tmpl = pickTemplateFields(r);
    const pol = pickPolicy(r);
    if (!pol.url) continue;
    outRows.push({ ...tmpl, ...pol });
  }

  const outPath = path.join(outDir, 'dataset.csv');
  await new Promise<void>((resolve, reject) => {
    stringify(outRows, { header: true }, (err, output) => {
      if (err) return reject(err);
      fs.writeFileSync(outPath, output, 'utf8');
      resolve();
    });
  });
  console.log(`Wrote ${outRows.length} rows to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
