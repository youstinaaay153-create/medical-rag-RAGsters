from flask import Flask, request, jsonify, send_from_directory
import os
import glob
import json

from query import load_index, retrieve
from generate import generate_grounded_answer
import config

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

app = Flask(__name__, static_url_path='', static_folder='static')

# Load index once when server starts
print("Loading vector database...")
try:
    vectordb = load_index()
    db_loaded = True
except Exception as e:
    print(f"Error loading vector database: {e}")
    db_loaded = False
    vectordb = None

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/api/config')
def get_config():
    """Expose REAL project configuration values to the frontend."""
    pdf_files = sorted(config.DATA_DIR.glob("*.pdf"))
    documents = [f.stem for f in pdf_files]

    return jsonify({
        "chunk_size": config.CHUNK_SIZE,
        "chunk_overlap": config.CHUNK_OVERLAP,
        "top_k": config.TOP_K,
        "embedding_provider": config.EMBEDDING_PROVIDER,
        "embedding_model": config.LOCAL_EMBEDDING_MODEL if config.EMBEDDING_PROVIDER == "local" else config.OPENAI_EMBEDDING_MODEL,
        "vector_db": "ChromaDB",
        "collection_name": config.COLLECTION_NAME,
        "generation_model": config.GEMINI_MODEL,
        "documents": documents,
        "chroma_dir": str(config.CHROMA_DIR),
    })

@app.route('/api/status')
def get_status():
    """Return real system component status."""
    gemini_configured = bool(config.GEMINI_API_KEY) and genai is not None
    return jsonify({
        "vector_db": db_loaded,
        "embeddings": db_loaded,
        "gemini": gemini_configured,
        "knowledge_base": db_loaded,
    })

@app.route('/api/search', methods=['POST'])
def search():
    if not db_loaded:
        return jsonify({"error": "Vector database is not loaded. Please run ingest.py first."}), 500

    data = request.json
    question = data.get('question', '').strip()
    
    if not question:
        return jsonify({"error": "Question cannot be empty."}), 400

    try:
        results = retrieve(vectordb, question)
        answer = generate_grounded_answer(question, results)

        # Build retrieved chunks for display
        retrieved_chunks = []
        for doc, score in results:
            meta = doc.metadata
            retrieved_chunks.append({
                "text": doc.page_content.strip(),
                "document": meta.get("document_name", "Unknown"),
                "page": meta.get("page_number", "?"),
                "chunk_id": meta.get("chunk_id", "N/A"),
                "score": round(score, 4),
            })
        
        # Format the response
        response_data = {
            "recommendation": answer.get("recommendation", "No answer found."),
            "evidence": answer.get("evidence", ""),
            "confidence": answer.get("confidence", "unknown"),
            "citations": answer.get("citations", []),
            "retrieved_chunks": retrieved_chunks,
        }
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify({"error": "An error occurred while generating the answer."}), 500

@app.route('/api/translate', methods=['POST'])
def translate():
    data = request.json
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"error": "Text empty"}), 400
        
    if not genai or not config.GEMINI_API_KEY:
        return jsonify({"error": "Gemini not configured"}), 500
        
    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        prompt = f"Translate the following medical text into clear, professional Arabic:\n\n{text}"
        response = client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt
        )
        return jsonify({"translated": response.text.strip()})
    except Exception as e:
        print(f"Translation error: {e}")
        return jsonify({"error": "Translation failed"}), 500

@app.route('/api/precheck', methods=['POST'])
def precheck():
    text = request.json.get('question', '').strip()
    if not text or not genai or not config.GEMINI_API_KEY: 
        return jsonify({"emergency": False, "out_of_scope": False})
    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        prompt = f"""Analyze this user question: "{text}"
Respond ONLY with a valid JSON object exactly like this: {{"emergency": true/false, "out_of_scope": true/false}}
"emergency" is true if it describes severe symptoms requiring immediate care (e.g. chest pain, severe bleeding, fainting).
"out_of_scope" is true if it's completely unrelated to medicine, health, biology, or the general domain of the guideline.
"""
        response = client.models.generate_content(
            model=config.GEMINI_MODEL, 
            contents=prompt, 
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return jsonify(json.loads(response.text.strip()))
    except Exception as e: 
        return jsonify({"emergency": False, "out_of_scope": False})

@app.route('/api/followup', methods=['POST'])
def followup():
    data = request.json
    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        prompt = f"Based on this question: '{data.get('question')}' and answer: '{data.get('answer')}', provide exactly 3 short follow-up questions the user might want to ask next. Respond ONLY as a JSON array of 3 strings."
        response = client.models.generate_content(
            model=config.GEMINI_MODEL, 
            contents=prompt, 
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return jsonify({"questions": json.loads(response.text.strip())})
    except Exception as e: 
        return jsonify({"questions": []})

@app.route('/api/simplify', methods=['POST'])
def simplify():
    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        prompt = f"Rewrite this medical text in extremely simple layman's terms for a patient. Keep it concise:\n\n{request.json.get('answer')}"
        response = client.models.generate_content(model=config.GEMINI_MODEL, contents=prompt)
        return jsonify({"simple": response.text.strip()})
    except Exception as e: 
        return jsonify({"error": "Failed to simplify"})

@app.route('/api/doctor_prep', methods=['POST'])
def doctor_prep():
    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        prompt = f"Based on this Q&A, generate a short bulleted list of 3 important questions the patient should ask their doctor during their next visit. Q: {request.json.get('question')} A: {request.json.get('answer')}"
        response = client.models.generate_content(model=config.GEMINI_MODEL, contents=prompt)
        return jsonify({"prep": response.text.strip()})
    except Exception as e: 
        return jsonify({"error": "Failed to prepare"})

if __name__ == '__main__':
    # Ensure static folder exists
    if not os.path.exists('static'):
        os.makedirs('static')
    
    print("Starting server on http://localhost:5000")
    app.run(debug=True, port=5000)
