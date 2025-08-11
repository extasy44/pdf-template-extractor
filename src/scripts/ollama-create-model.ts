import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import child_process from 'node:child_process';

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../../..');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function run(cmd: string, cwd: string) {
  child_process.execSync(cmd, { stdio: 'inherit', cwd });
}

async function main() {
  const root = getProjectRoot();
  const modelDir = path.join(root, 'artifacts', 'model');
  const trainPath = path.join(root, 'artifacts', 'train', 'train.jsonl');
  ensureDir(modelDir);

  const base = 'mistral:7b-instruct';
  const modelName = 'policy-extractor-ollama';
  const modelfile = `FROM ${base}\nPARAMETER temperature 0.2\nTEMPLATE """\nSYSTEM: You extract car insurance policy fields from policy text and return a JSON object that fills the provided template fields. Leave missing values empty.\nUSER:\n{{.Prompt}}\nASSISTANT:\n"""\n`;

  fs.writeFileSync(path.join(modelDir, 'Modelfile'), modelfile, 'utf8');

  console.log('Creating model via ollama...');
  run(`ollama create ${modelName} -f Modelfile`, modelDir);

  if (fs.existsSync(trainPath)) {
    console.log(
      'Note: Ollama does not support fine-tuning weights for most models locally yet; use prompt-adapter or serve messages as RAG. The train.jsonl can be used with OpenAI/Fireworks/DeepSeek finetune if needed.'
    );
  } else {
    console.warn('Warning: training JSONL missing, create it with npm run trainset');
  }

  fs.writeFileSync(path.join(modelDir, 'model-name.txt'), modelName, 'utf8');
  console.log(`Model ready: ${modelName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
