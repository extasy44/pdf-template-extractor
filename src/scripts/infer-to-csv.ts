import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import child_process from 'node:child_process';

function run(cmd: string, input?: string): string {
  const out = child_process.spawnSync(cmd, { shell: true, input, encoding: 'utf8' });
  if (out.error) throw out.error;
  if (out.status !== 0) throw new Error(out.stderr || `Command failed: ${cmd}`);
  return out.stdout;
}

async function readCsv(filePath: string): Promise<Array<Record<string, string>>> {
  const content = fs.readFileSync(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    parse(content, { columns: true }, (err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
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
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: tsx src/scripts/infer-to-csv.ts <modelName> <templateCsv> <policyTxt> [outCsv]');
    process.exit(1);
  }
  const [modelName, templateCsv, policyTxt, outCsv = 'artifacts/predictions.csv'] = args;
  const policyText = fs.readFileSync(policyTxt, 'utf8');
  const rows = await readCsv(templateCsv);
  const augmented: Array<Record<string, string>> = [];

  for (const row of rows) {
    const prompt = buildPrompt(policyText, row);
    const out = run(`ollama run ${modelName}`, prompt).trim();
    let content = '';
    try {
      const parsed = JSON.parse(out);
      content = typeof parsed === 'string' ? parsed : parsed['Policy Content'] || parsed['policyContent'] || JSON.stringify(parsed);
    } catch {
      content = out;
    }
    augmented.push({ ...row, 'Policy Content': content });
  }

  await new Promise<void>((resolve, reject) => {
    stringify(augmented, { header: true }, (err, output) => {
      if (err) return reject(err);
      fs.writeFileSync(outCsv, output, 'utf8');
      resolve();
    });
  });
  console.log(`Wrote predictions to ${outCsv}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
