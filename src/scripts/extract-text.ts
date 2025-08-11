import fs from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse';
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

async function extractPdfText(pdfPath: string): Promise<string> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  return data.text;
}

async function main() {
  const root = getProjectRoot();
  const pdfDir = path.join(root, 'artifacts', 'pdf');
  const outDir = path.join(root, 'artifacts', 'text');
  ensureDir(outDir);

  const files = fs.existsSync(pdfDir) ? fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf')) : [];
  const limit = pLimit(4);
  const tasks = files.map((f) =>
    limit(async () => {
      const source = path.join(pdfDir, f);
      const out = path.join(outDir, f.replace(/\.pdf$/i, '.txt'));
      if (fs.existsSync(out)) return;
      const text = await extractPdfText(source);
      fs.writeFileSync(out, text, 'utf8');
    })
  );

  await Promise.all(tasks);
  console.log(`Extracted text to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
