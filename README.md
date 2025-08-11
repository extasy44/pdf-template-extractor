## Policy Comparison Fine-tune (Ollama first)

Windows-friendly workflow to prepare a PDF-to-template extraction dataset, build an Ollama prompt-tuned model, and run inference.

### Prerequisites

- Node.js 20+
- Ollama installed and running (`ollama serve`)

### Quickstart

1. Install deps

```
npm i
```

2. Download PDFs referenced in `data/fine-tuning-data.csv`

```
npm run download
```

3. Extract text to `artifacts/text/`

```
npm run extract
```

4. Build training JSONL at `artifacts/train/train.jsonl`

```
npm run trainset
```

5. Create the Ollama model (prompt-tuning via Modelfile)

```
npm run ollama:model
```

6. Run inference on a new PDF or raw text using the question template in `template/question-template.csv`

```
npm run ollama:infer
```

CSV output option:

```
npm run ollama:infer:csv
```

Edit the script args in `package.json` or call directly:

```
tsx src/scripts/infer-to-csv.ts policy-extractor-ollama template/question-template.csv artifacts/text/your_policy.txt artifacts/predictions.csv
```

### Structure

- `data/fine-tuning-data.csv`: labeled examples and policy PDF URLs
- `template/question-template.csv`: section template rows (empty values)
- `artifacts/`: outputs
  - `pdf/`: downloaded PDFs
  - `text/`: extracted text per PDF
  - `train/`: JSONL training file
  - `model/`: Modelfile and created model name

### Notes

- If a value cannot be found in a policy, fields remain empty
- Parsing is heuristic; mapping prioritizes semantic cues and nearby headings
- Works with any policy PDF whose text layer is extractable
