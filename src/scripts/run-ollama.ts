import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import child_process from 'node:child_process';
import { parse } from 'csv-parse';

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../../..');
}

async function readTemplateCsv(): Promise<Array<Record<string, string>>> {
  const root = getProjectRoot();
  const p = path.join(root, 'template', 'question-template.csv');
  const content = fs.readFileSync(p, 'utf8');
  return new Promise((resolve, reject) => {
    parse(content, { columns: true }, (err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
}

function run(cmd: string, input?: string): string {
  const out = child_process.spawnSync(cmd, { shell: true, input, encoding: 'utf8' });
  if (out.error) throw out.error;
  if (out.status !== 0) throw new Error(out.stderr || `Command failed: ${cmd}`);
  return out.stdout;
}

function buildPrompt(policyText: string, row: Record<string, string>) {
  const template = {
    'Cover Name': row['Cover Name'] || '',
    'Section Name': row['Section Name'] || '',
    'Feature Name': row['Feature Name'] || '',
    'Feature ID': row['Feature ID'] || '',
    'Point to Consider': row['Point to Consider'] || '',
    'Policy Name': row['Policy Name'] || '',
    'Policy Code': row['Policy Code'] || '',
    'Policy Insurer': row['Policy Insurer'] || '',
    'Policy Page': row['Policy Page'] || '',
    'Policy Content': '',
  };
  const instructions = 'Fill Policy Content from the policyText. Leave fields not derivable empty. Respond with JSON only.';
  return JSON.stringify({ instructions, policyText, template });
}

async function main() {
  const root = getProjectRoot();
  const modelNameFile = path.join(root, 'artifacts', 'model', 'model-name.txt');
  const modelName = fs.existsSync(modelNameFile) ? fs.readFileSync(modelNameFile, 'utf8').trim() : 'policy-extractor-ollama';

  const args = process.argv.slice(2);
  const inputPdfOrTxt = args[0];
  if (!inputPdfOrTxt) {
    console.log('Usage: npm run ollama:infer -- path/to/policy.txt');
    process.exit(1);
  }
  const policyText = fs.readFileSync(inputPdfOrTxt, 'utf8');
  const templateRows = await readTemplateCsv();

  for (const row of templateRows.slice(0, 16)) {
    // cap for demo
    const prompt = buildPrompt(policyText, row);
    const cmd = `ollama run ${modelName}`;
    const out = run(cmd, prompt);
    console.log(out.trim());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
