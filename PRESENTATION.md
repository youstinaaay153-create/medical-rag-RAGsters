# AI Clinical Decision Support Lite — Presentation Content

---

## Slide 1: Title

**AI Clinical Decision Support Lite**
Evidence-Grounded Medical Intelligence powered by RAG

---

## Slide 2: Problem Statement

- Clinicians need **rapid, evidence-based answers** during patient care
- General AI models **hallucinate** medical advice and invent citations
- Unsupported medical recommendations = **patient safety risk**
- Manual guideline search is **slow** and **error-prone**

---

## Slide 3: Proposed Solution

A Retrieval-Augmented Generation (RAG) system that:

1. **Indexes** official medical guidelines into a vector database
2. **Retrieves** the most relevant passages for any clinical question
3. **Generates** a grounded answer using Google Gemini — constrained to only the retrieved evidence
4. **Validates** citations against retrieved sources to prevent hallucination
5. **Refuses** to answer if evidence is insufficient

---

## Slide 4: System Architecture

```
Medical PDF → PDF Parsing → Chunking → Embeddings → ChromaDB → Retrieval → Context → Gemini → Grounded Answer
```

Key architectural decisions:
- **Local embeddings** (no API cost for indexing)
- **Structured output** via Pydantic schema
- **Citation validation** (programmatic anti-hallucination)
- **Safe refusal** when evidence is insufficient

---

## Slide 5: How RAG Works

1. **User asks** a clinical question
2. Question is **embedded** into a vector
3. **Similarity search** against indexed guideline chunks
4. Top-K **relevant passages** are retrieved with scores
5. Passages are sent as **context** to Gemini
6. Gemini generates a **grounded, structured** answer
7. System **validates** that all citations are real

---

## Slide 6: Chunking Strategy

| Parameter       | Value                  |
|---|---|
| Chunk Size      | **400 tokens** (~1600 chars) |
| Chunk Overlap   | **50 tokens** (~200 chars)  |
| Top-K           | **4**                  |
| Splitter        | RecursiveCharacterTextSplitter |
| Separators      | `\n\n`, `\n`, `. `, ` ` |

Each chunk carries citation metadata: `document_name`, `page_number`, `chunk_id`

---

## Slide 7: Technology Stack

| Component        | Technology                        |
|---|---|
| Embeddings       | FastEmbed (`BAAI/bge-small-en-v1.5`) — local, free |
| Vector Database  | ChromaDB — local, persistent       |
| LLM              | Google Gemini (`gemini-3.6-flash`) |
| Framework        | LangChain                          |
| Schema           | Pydantic + JSON Schema             |
| Web UI           | Flask + HTML/CSS/JS                |

---

## Slide 8: End-to-End RAG Pipeline

**Live Demo Flow:**

Question → Embedding → Vector DB → Retrieval → Evidence → Gemini → Answer

Each stage is visualized in the dashboard with animated pipeline nodes.

---

## Slide 9: Demo — Normal Clinical Question

**Question:**
"What is the target blood pressure for a patient with known cardiovascular disease?"

**Expected behavior:**
- Retrieves relevant chunks from WHO Guideline Page 9
- Generates a grounded recommendation
- Cites the exact source document and page

---

## Slide 10: Retrieved Evidence

After retrieval, the dashboard shows **each retrieved chunk** with:
- Source document name
- Page number
- Relevance score
- Text excerpt

This proves the answer is grounded in real medical evidence.

---

## Slide 11: AI Generated Grounded Answer

The structured response includes:
- **Recommendation**: Direct clinical answer
- **Evidence**: Exact quoted excerpt from the guideline
- **Citations**: Document name, section, page number
- **Confidence**: high / medium / low / insufficient

---

## Slide 12: Emergency Scenario

**Question:**
"Which antihypertensive medications are contraindicated during pregnancy?"

**Expected:** Retrieves WHO Guideline Section 4.3 (Page 10), provides a grounded answer about contraindicated medications with proper citation.

This demonstrates the system handles urgent clinical questions responsibly.

---

## Slide 13: Safe Refusal Demo

**Question:**
"What is the recommended screening interval for breast cancer?"

**Expected:** 
- Confidence: `insufficient`
- The system **refuses** to answer
- No hallucinated medical advice
- Empty citations

This proves the system is **safe** — it won't invent information.

---

## Slide 14: Requirements Coverage

| Requirement                    | Status |
|---|---|
| Medical document ingestion     | ✅ |
| Chunking                      | ✅ |
| Embeddings                    | ✅ |
| Vector database               | ✅ |
| Retrieval with scores         | ✅ |
| LLM generation                | ✅ |
| End-to-end pipeline           | ✅ |
| JSON Schema validation        | ✅ |
| Citation validation           | ✅ |
| Safe refusal                  | ✅ |
| Web UI dashboard              | ✅ |
| Evaluation test sets          | ✅ |

---

## Slide 15: Evaluation

| Test Set                        | Cases | Purpose                    |
|---|---|---|
| Day2_Evaluation_Test_Set.csv    | 8     | Retrieval quality          |
| Day3_Refusal_Test_Cases.csv     | 10    | Safety / refusal testing   |
| Day4_Starter_Benchmark.csv      | 12    | End-to-end benchmark       |

Metrics: Precision@k, Citation Accuracy, Faithfulness

---

## Slide 16: Limitations & Medical Safety

**Limitations:**
- Answers limited to indexed knowledge base
- Retrieval quality affects answer quality
- Decision-support prototype only
- No patient-specific reasoning

**Medical Disclaimer:**
Always verify clinical recommendations against authoritative medical guidelines and professional clinical judgment.

---

## Slide 17: Conclusion

**AI Clinical Decision Support Lite** demonstrates:

✅ A fully functional RAG pipeline for clinical decision support
✅ Evidence-grounded answers from real medical guidelines
✅ Anti-hallucination safeguards (citation validation + safe refusal)
✅ Professional, presentation-ready 3D medical dashboard
✅ Complete evaluation framework

**The system never guesses. It either cites evidence or refuses.**

---

*Built with: LangChain, ChromaDB, FastEmbed, Google Gemini, Flask*
