# AI Clinical Decision Support Lite — Medical RAG

A professional, end-to-end Retrieval-Augmented Generation (RAG) system for evidence-based clinical question answering. Built for the **AI Clinical Decision Support Lite Hackathon**.

---

## Problem Statement

Clinicians need rapid, evidence-grounded answers to treatment questions during patient care. General-purpose AI models can hallucinate medical advice, invent citations, and provide unsupported recommendations — creating serious patient safety risks.

## Solution

This system constrains AI-generated answers to **only** the information present in indexed medical guidelines. It retrieves the most relevant guideline passages, sends them as context to Google Gemini, and enforces structured output with validated citations. If evidence is insufficient, the system **refuses** to answer rather than guessing.

---

## Architecture

```
Medical PDF (data/)
  └── PDF Parsing (PyPDFLoader)
      └── Chunking (RecursiveCharacterTextSplitter)
          └── Citation Metadata (document_name, page_number, chunk_id)
              └── Embeddings (Local FastEmbed / BAAI/bge-small-en-v1.5)
                  └── Vector Storage (ChromaDB)
                      └── Retrieval (similarity_search_with_relevance_scores)
                          └── Context Construction
                              └── Grounded Generation (Google Gemini)
                                  └── Structured JSON Output (Schema-validated + Citation-validated)
```

---

## RAG Configuration

| Parameter         | Value                        |
|---|---|
| **Chunk Size**    | 400 tokens (~1600 chars)     |
| **Chunk Overlap** | 50 tokens (~200 chars)       |
| **Top-K**         | 4                            |
| **Embedding Model** | `BAAI/bge-small-en-v1.5` (local, free) |
| **Vector Database** | ChromaDB (local, persistent) |
| **Generation Model** | `gemini-3.6-flash` (via `google-genai` SDK) |
| **Chunking Strategy** | `RecursiveCharacterTextSplitter` with separators: `\n\n`, `\n`, `. `, ` `, `""` |

---

## Data Source

- **Document:** `WHO_Hypertension_Guideline_2021.pdf`
- **Location:** `data/`
- **Pages:** 13
- **Topics:** Blood pressure thresholds, first-line drug classes, combination therapy, target blood pressure, follow-up frequency, pregnancy contraindications, COVID-19, disaster settings, treatment protocols.

---

## Technologies

| Component            | Technology                       |
|---|---|
| Language             | Python 3.x                      |
| PDF Parsing          | `pypdf` via `PyPDFLoader`        |
| Text Splitting       | `langchain` `RecursiveCharacterTextSplitter` |
| Embeddings           | `fastembed` (`BAAI/bge-small-en-v1.5`) |
| Vector Database      | `chromadb` (local, persistent)   |
| LLM                  | Google Gemini (`google-genai`)   |
| Structured Output    | Pydantic + JSON Schema           |
| Schema Validation    | `jsonschema`                     |
| Web Framework        | Flask                            |
| Frontend             | HTML / CSS / JavaScript          |

---

## Project Structure

| File / Folder                 | Purpose                                                     |
|---|---|
| `config.py`                   | Central configuration (chunk size, top-k, model, paths)     |
| `ingest.py`                   | PDF loading → chunking → embedding → ChromaDB indexing      |
| `query.py`                    | Retrieval: queries ChromaDB, returns scored chunks           |
| `generate.py`                 | Grounded generation with Gemini (structured output + validation) |
| `pipeline.py`                 | End-to-end CLI pipeline (retrieval + generation)             |
| `server.py`                   | Flask web server (API endpoints + static file serving)       |
| `static/`                     | Frontend dashboard (HTML, CSS, JS)                           |
| `schema/response_schema.json` | JSON Schema enforcing structured output                      |
| `eval/`                       | Evaluation test sets (retrieval, refusal, benchmark)         |
| `data/`                       | Source medical PDFs                                          |
| `.env.example`                | Template for environment variables                           |
| `requirements.txt`            | Python dependencies                                          |

---

## Installation

```bash
# 1. Create virtual environment
python -m venv ragv

# 2. Activate (Windows CMD)
ragv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
pip install flask

# 4. Configure environment
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

## Environment Variables

```env
EMBEDDING_PROVIDER=local
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

- `GEMINI_API_KEY` is only required for the generation stage. Ingestion and retrieval work without it.

---

## How to Run

### Build the vector database (first time only)
```bash
python ingest.py
```

### Start the web dashboard
```bash
python server.py
```
Then open: `http://localhost:5000`

### CLI usage (alternative)
```bash
python pipeline.py "What is the target blood pressure for a patient with known cardiovascular disease?"
```

---

## Example Clinical Questions

**Normal question (in-scope):**
```
What is the target blood pressure for a patient with known cardiovascular disease?
```
Expected: Grounded answer with citation from WHO Guideline, Page 9.

**Emergency/urgent scenario (in-scope):**
```
Which antihypertensive medications are contraindicated during pregnancy?
```
Expected: Grounded answer citing WHO Guideline Section 4.3, Page 10.

**Out-of-scope question (refusal test):**
```
What is the recommended screening interval for breast cancer?
```
Expected: Confidence = "insufficient", safe refusal, no hallucinated answer.

---

## Requirements Coverage

| Requirement                          | Status        | Implementation                |
|---|---|---|
| Medical document ingestion           | ✅ Implemented | `ingest.py`                   |
| Chunking                            | ✅ Implemented | `ingest.py`                   |
| Embeddings                          | ✅ Implemented | `ingest.py` (FastEmbed)       |
| Vector database                     | ✅ Implemented | ChromaDB (`chroma_db/`)       |
| Retrieval with scores               | ✅ Implemented | `query.py`                    |
| LLM generation                      | ✅ Implemented | `generate.py` (Gemini)        |
| End-to-end pipeline                 | ✅ Implemented | `pipeline.py`                 |
| JSON Schema validation              | ✅ Implemented | `schema/response_schema.json` |
| Citation validation (anti-hallucination) | ✅ Implemented | `generate.py`             |
| Safe refusal                        | ✅ Implemented | `generate.py`                 |
| Web UI dashboard                    | ✅ Implemented | `server.py` + `static/`       |
| Evaluation test sets                | ✅ Provided    | `eval/*.csv`                  |

---

## Evaluation

Evaluation test sets are provided in `eval/`:

| File                          | Purpose                              | Cases |
|---|---|---|
| `Day2_Evaluation_Test_Set.csv` | Retrieval quality (Precision@k)     | 8     |
| `Day3_Refusal_Test_Cases.csv`  | Safety / refusal testing             | 10    |
| `Day4_Starter_Benchmark.csv`   | End-to-end benchmark (Precision@k, Citation Accuracy, Faithfulness) | 12 |

Results should be measured by running the test questions through `pipeline.py` and evaluating against the expected sources and behaviors listed in each CSV.

---

## Limitations

- Answers are limited to the indexed knowledge base (currently: WHO Hypertension Guideline 2021).
- Retrieval quality directly affects answer quality.
- This is a **decision-support prototype**, not a diagnostic or prescriptive system.
- Uses lightweight local embeddings (`BAAI/bge-small-en-v1.5`) which may have lower accuracy than larger models.
- No patient-specific reasoning — individualized dosing or drug-interaction questions are out of scope.

---

## Medical Disclaimer

> **Decision-support prototype.** Always verify clinical recommendations against authoritative medical guidelines and professional clinical judgment. Do not use for actual patient care without independent verification.

---

## Troubleshooting

- **`Vector database not found`**: Run `python ingest.py` first.
- **`GEMINI_API_KEY is missing`**: Add your API key to `.env`. Ingestion and retrieval work without it.
- **Rebuilding the index**: Delete `chroma_db/` and re-run `python ingest.py`.
