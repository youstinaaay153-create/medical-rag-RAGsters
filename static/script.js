/**
 * AI Clinical Decision Support — Dashboard Logic
 * Connects the premium 3D UI to the real backend API endpoints.
 * No fake data. All values come from the server.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ── DOM Elements ──
    const questionInput = document.getElementById('questionInput');
    const askBtn        = document.getElementById('askBtn');
    const resultsSection = document.getElementById('resultsSection');
    const echoText      = document.getElementById('echoText');
    const answerBody    = document.getElementById('answerBody');
    const evidenceQuote = document.getElementById('evidenceQuote');
    const confPill      = document.getElementById('confidenceBadge') || document.getElementById('confPill');
    const confLabel     = document.getElementById('confLabel');
    const citationsList = document.getElementById('citationsList');
    const chunksContainer = document.getElementById('chunksContainer');
    const chunkCount    = document.getElementById('chunkCount');
    const copyBtn       = document.getElementById('copyBtn');
    const transBtn      = document.getElementById('transBtn');
    const translationBox = document.getElementById('translationBox');

    // Pipeline nodes & lines
    const pipelineNodes = [
        document.getElementById('pn-question'),
        document.getElementById('pn-embed'),
        document.getElementById('pn-vdb'),
        document.getElementById('pn-retrieve'),
        document.getElementById('pn-evidence'),
        document.getElementById('pn-gemini'),
        document.getElementById('pn-answer'),
    ];
    const pipelineLines = [
        document.getElementById('pl-1'),
        document.getElementById('pl-2'),
        document.getElementById('pl-3'),
        document.getElementById('pl-4'),
        document.getElementById('pl-5'),
        document.getElementById('pl-6'),
    ];

    let currentRecommendation = '';

    // ── 1. Fetch REAL Config from backend ──
    fetch('/api/config')
        .then(r => r.json())
        .then(cfg => {
            document.getElementById('cfg-chunk').textContent   = cfg.chunk_size + ' tokens';
            document.getElementById('cfg-overlap').textContent = cfg.chunk_overlap + ' tokens';
            document.getElementById('cfg-topk').textContent    = cfg.top_k;
            document.getElementById('cfg-embed').textContent   = cfg.embedding_model;
            document.getElementById('cfg-vdb').textContent     = cfg.vector_db;
            document.getElementById('cfg-llm').textContent     = cfg.generation_model;

            // Knowledge Base
            if (cfg.documents && cfg.documents.length > 0) {
                const docName = cfg.documents[0].replace(/_/g, ' ');
                document.getElementById('kbDocName').textContent = docName;
                document.getElementById('kbMeta').textContent    = `Indexed & Active • ${cfg.vector_db} (${cfg.collection_name})`;
            }
        })
        .catch(() => {
            document.getElementById('cfg-chunk').textContent = 'Error';
        });

    // ── 2. Fetch REAL Status from backend ──
    fetch('/api/status')
        .then(r => r.json())
        .then(s => {
            setStatus('stat-rag', s.vector_db, 'Ready', 'Offline');
            setStatus('stat-vdb', s.vector_db, 'Connected', 'Disconnected');
            setStatus('stat-emb', s.embeddings, 'Ready', 'Offline');
            setStatus('stat-gem', s.gemini, 'Connected', 'Not Configured');

            // Update dots
            document.querySelectorAll('.status-grid li').forEach(li => {
                const dot = li.querySelector('.dot');
                const val = li.querySelector('.val');
                if (val && (val.textContent === 'Ready' || val.textContent === 'Connected')) {
                    dot.className = 'dot dot-ok';
                } else {
                    dot.className = 'dot dot-err';
                }
            });
        })
        .catch(() => {});

    function setStatus(id, ok, yesText, noText) {
        const el = document.getElementById(id);
        if (el) el.textContent = ok ? yesText : noText;
    }

    // ── 3. Pipeline Animation ──
    function resetPipeline() {
        pipelineNodes.forEach(n => n && n.classList.remove('active'));
        pipelineLines.forEach(l => l && l.classList.remove('active'));
    }

    async function animatePipeline() {
        resetPipeline();
        for (let i = 0; i < pipelineNodes.length; i++) {
            pipelineNodes[i].classList.add('active');
            if (i > 0 && pipelineLines[i - 1]) pipelineLines[i - 1].classList.add('active');
            await sleep(350);
        }
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ── 4. Example question buttons ──
    document.querySelectorAll('.example-q').forEach(btn => {
        btn.addEventListener('click', () => {
            questionInput.value = btn.dataset.q;
            questionInput.focus();
        });
    });

    // ── 5. Main Search ──
    async function doSearch() {
        const question = questionInput.value.trim();
        if (!question) return;

        // Reset UI
        resultsSection.classList.add('hidden');
        translationBox.classList.add('hidden');
        translationBox.innerHTML = '';
        transBtn.innerHTML = '<i class="fa-solid fa-language"></i> Translate to Arabic';
        transBtn.disabled = false;
        askBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        askBtn.disabled = true;

        // Animate pipeline
        const animPromise = animatePipeline();

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question }),
            });
            const data = await res.json();
            await animPromise;

            if (!res.ok) {
                alert(data.error || 'An error occurred.');
                return;
            }

            // Populate question echo
            echoText.textContent = question;

            // Populate answer
            currentRecommendation = data.recommendation;
            answerBody.textContent = data.recommendation;

            // Evidence quote
            evidenceQuote.textContent = data.evidence ? `"${data.evidence}"` : '';

            // Confidence
            const conf = (data.confidence || 'unknown').toLowerCase();
            confPill.className = 'confidence-pill';
            let confIcon = 'fa-check-circle';
            if (conf === 'high')        { confPill.classList.add('conf-high'); confIcon = 'fa-check-double'; }
            else if (conf === 'medium') { confPill.classList.add('conf-med');  confIcon = 'fa-exclamation-circle'; }
            else if (conf === 'low')    { confPill.classList.add('conf-low');  confIcon = 'fa-triangle-exclamation'; }
            else                        { confPill.classList.add('conf-insuf'); confIcon = 'fa-circle-xmark'; }
            confPill.innerHTML = `<i class="fa-solid ${confIcon}"></i> <span>${conf.toUpperCase()}</span>`;

            // Citations
            citationsList.innerHTML = '';
            if (data.citations && data.citations.length > 0) {
                data.citations.forEach(c => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${c.document || 'Unknown'}</strong> — Section: ${c.section || 'N/A'}, Page: ${c.page || 'N/A'}`;
                    citationsList.appendChild(li);
                });
            } else {
                citationsList.innerHTML = '<li style="color:var(--text-muted);">No citations available.</li>';
            }

            // Retrieved Chunks
            chunksContainer.innerHTML = '';
            if (data.retrieved_chunks && data.retrieved_chunks.length > 0) {
                chunkCount.textContent = `(${data.retrieved_chunks.length} chunks)`;
                data.retrieved_chunks.forEach((chunk, i) => {
                    const div = document.createElement('div');
                    div.className = 'chunk-card';
                    div.innerHTML = `
                        <div class="chunk-meta">
                            <span>#${i + 1} — ${chunk.document}, Page ${chunk.page}</span>
                            <span class="chunk-score">Score: ${chunk.score}</span>
                        </div>
                        <div class="chunk-text">${truncate(chunk.text, 350)}</div>
                    `;
                    chunksContainer.appendChild(div);
                });
            } else {
                chunkCount.textContent = '(0 chunks)';
                chunksContainer.innerHTML = '<p class="muted">No chunks retrieved.</p>';
            }

            // Show results
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            alert('Failed to connect to the server. Make sure server.py is running.');
            resetPipeline();
        } finally {
            askBtn.innerHTML = '<span class="btn-text">Ask AI</span> <i class="fa-solid fa-arrow-right btn-arrow"></i>';
            askBtn.disabled = false;
        }
    }

    function truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    askBtn.addEventListener('click', doSearch);
    questionInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    // ── 6. Copy ──
    copyBtn.addEventListener('click', () => {
        if (!currentRecommendation) return;
        navigator.clipboard.writeText(currentRecommendation).then(() => {
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 2000);
        });
    });

    // ── 7. Translate ──
    transBtn.addEventListener('click', async () => {
        if (!currentRecommendation) return;
        transBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating...';
        transBtn.disabled = true;
        try {
            const r = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: currentRecommendation }),
            });
            const d = await r.json();
            if (r.ok) {
                translationBox.innerHTML = `<strong>الترجمة العربية:</strong><br>${d.translated}`;
                translationBox.classList.remove('hidden');
                transBtn.innerHTML = '<i class="fa-solid fa-check"></i> Translated';
            } else {
                transBtn.innerHTML = 'Failed';
                transBtn.disabled = false;
            }
        } catch (e) {
            transBtn.innerHTML = 'Error';
            transBtn.disabled = false;
        }
    });
});
