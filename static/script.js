/**
 * AI Clinical Decision Support — Dashboard Logic
 * Connects the premium 3D UI to the real backend API endpoints.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ── DOM Elements ──
    const questionInput = document.getElementById('questionInput');
    const askBtn        = document.getElementById('askBtn');
    const micBtn        = document.getElementById('micBtn');
    const resultsSection = document.getElementById('resultsSection');
    const echoText      = document.getElementById('echoText');
    const answerBody    = document.getElementById('answerBody');
    const evidenceQuote = document.getElementById('evidenceQuote');
    const confPill      = document.getElementById('confidenceBadge') || document.getElementById('confPill');
    const confLabel     = document.getElementById('confLabel');
    const citationsList = document.getElementById('citationsList');
    const chunksContainer = document.getElementById('chunksContainer') || document.getElementById('inlineChunks');
    const chunkCount    = document.getElementById('chunkCount') || document.createElement('span');
    const copyBtn       = document.getElementById('copyBtn');
    const transBtn      = document.getElementById('transBtn');
    const saveBtn       = document.getElementById('saveBtn');
    const simplifyBtn   = document.getElementById('simplifyBtn');
    const prepBtn       = document.getElementById('prepBtn');
    const pdfBtn        = document.getElementById('pdfBtn');
    const translationBox = document.getElementById('translationBox');
    const themeToggle   = document.getElementById('themeToggle');
    const langToggle    = document.getElementById('langToggle');
    const safetyWarning = document.getElementById('safetyWarning');
    const retrievalInfo = document.getElementById('retrievalInfo');
    const respTime      = document.getElementById('respTime');
    const srcCount      = document.getElementById('srcCount');
    const followUpsContainer = document.getElementById('followUpsContainer');
    const followUpsList = document.getElementById('followUpsList');
    const historyList   = document.getElementById('historyList');
    const savedList     = document.getElementById('savedList');
    const newChatBtn    = document.getElementById('newChatBtn');

    // Modals
    const simpleModal = document.getElementById('simpleModal');
    const simpleText  = document.getElementById('simpleText');
    const prepModal   = document.getElementById('prepModal');
    const prepText    = document.getElementById('prepText');

    let currentRecommendation = '';
    let currentQuestion = '';

    // ── 0. Theme & Language Toggle Logic ──
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('light-mode')) {
            icon.className = 'fa-solid fa-moon';
        } else {
            icon.className = 'fa-solid fa-sun';
        }
    });

    const translations = {
        'en': { badge: 'Clinical AI Prototype', ask: 'Ask AI', ai_rec: 'AI Clinical Recommendation', sources: 'Source Citations', show_evid: 'Show Evidence', copy: 'Copy', save: 'Save', translate: 'Translate to Arabic', simplify: 'Explain Simple', prep: 'Doctor Prep', download: 'Download Report', suggested: 'Suggested Follow-ups', disclaimer: 'Medical Disclaimer:', disc_text: 'Decision-support prototype. Always verify clinical recommendations against authoritative medical guidelines.', simple_expl: 'Simple Explanation', doc_prep: 'Prepare for Doctor Visit' },
        'ar': { badge: 'نموذج ذكاء اصطناعي طبي', ask: 'اسأل الذكاء الاصطناعي', ai_rec: 'التوصية الطبية للذكاء الاصطناعي', sources: 'مصادر الأدلة', show_evid: 'إظهار الدليل', copy: 'نسخ', save: 'حفظ', translate: 'ترجمة للإنجليزية', simplify: 'شرح مبسط', prep: 'تحضير للطبيب', download: 'تحميل كتقرير', suggested: 'أسئلة مقترحة', disclaimer: 'تنبيه طبي:', disc_text: 'هذا نموذج تجريبي. يرجى مراجعة التوصيات مع الأدلة الطبية المعتمدة واستشارة الطبيب المختص.', simple_expl: 'شرح مبسط للمريض', doc_prep: 'تحضير لزيارة الطبيب' }
    };

    let currentLang = 'en';
    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        if (currentLang === 'ar') document.body.classList.add('rtl');
        else document.body.classList.remove('rtl');
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[currentLang][key]) el.textContent = translations[currentLang][key];
        });
        langToggle.innerHTML = currentLang === 'en' ? '<i class="fa-solid fa-earth-americas"></i> <span style="font-size: 0.7rem; font-family: var(--font);">AR</span>' : '<i class="fa-solid fa-earth-americas"></i> <span style="font-size: 0.7rem; font-family: var(--font);">EN</span>';
    });

    // ── Voice Input (Web Speech API) ──
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && micBtn) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        micBtn.addEventListener('click', () => {
            recognition.lang = currentLang === 'ar' ? 'ar-SA' : 'en-US';
            micBtn.classList.add('recording');
            recognition.start();
        });
        
        recognition.onresult = (e) => {
            questionInput.value = e.results[0][0].transcript;
            micBtn.classList.remove('recording');
            doSearch();
        };
        recognition.onerror = () => micBtn.classList.remove('recording');
        recognition.onend = () => micBtn.classList.remove('recording');
    } else if (micBtn) {
        micBtn.style.display = 'none';
    }

    // Pipeline nodes
    const pipelineNodes = [
        document.getElementById('pn-question'), document.getElementById('pn-embed'),
        document.getElementById('pn-vdb'), document.getElementById('pn-retrieve'),
        document.getElementById('pn-evidence'), document.getElementById('pn-gemini'), document.getElementById('pn-answer')
    ];
    const pipelineLines = [
        document.getElementById('pl-1'), document.getElementById('pl-2'),
        document.getElementById('pl-3'), document.getElementById('pl-4'),
        document.getElementById('pl-5'), document.getElementById('pl-6')
    ];

    // ── 1. Fetch REAL Config ──
    fetch('/api/config').then(r => r.json()).then(cfg => {
        if(document.getElementById('cfg-chunk')) {
            document.getElementById('cfg-chunk').textContent   = cfg.chunk_size + ' tokens';
            document.getElementById('cfg-overlap').textContent = cfg.chunk_overlap + ' tokens';
            document.getElementById('cfg-topk').textContent    = cfg.top_k;
            document.getElementById('cfg-embed').textContent   = cfg.embedding_model;
            document.getElementById('cfg-vdb').textContent     = cfg.vector_db;
            document.getElementById('cfg-llm').textContent     = cfg.generation_model;
            if (cfg.documents && cfg.documents.length > 0) {
                document.getElementById('kbDocName').textContent = cfg.documents[0].replace(/_/g, ' ');
                document.getElementById('kbMeta').textContent    = `Indexed • ${cfg.vector_db}`;
            }
        }
    }).catch(()=>{});

    fetch('/api/status').then(r => r.json()).then(s => {
        const setStatus = (id, ok) => {
            const el = document.getElementById(id);
            if (el) el.textContent = ok ? 'Ready' : 'Offline';
        };
        setStatus('stat-rag', s.vector_db);
        setStatus('stat-vdb', s.vector_db);
        setStatus('stat-emb', s.embeddings);
        setStatus('stat-gem', s.gemini);
        document.querySelectorAll('.status-grid li').forEach(li => {
            const val = li.querySelector('.val');
            if (val && val.textContent === 'Ready') li.querySelector('.dot').className = 'dot dot-ok';
            else if (val) li.querySelector('.dot').className = 'dot dot-err';
        });
    }).catch(()=>{});

    function resetPipeline() {
        pipelineNodes.forEach(n => n && n.classList.remove('active'));
        pipelineLines.forEach(l => l && l.classList.remove('active'));
    }
    async function animatePipeline() {
        resetPipeline();
        for (let i = 0; i < pipelineNodes.length; i++) {
            if(pipelineNodes[i]) pipelineNodes[i].classList.add('active');
            if (i > 0 && pipelineLines[i - 1]) pipelineLines[i - 1].classList.add('active');
            await new Promise(r => setTimeout(r, 350));
        }
    }

    document.querySelectorAll('.example-q').forEach(btn => {
        btn.addEventListener('click', () => {
            questionInput.value = btn.dataset.q;
            questionInput.focus();
        });
    });

    // ── Local Storage Logic ──
    const getStorage = (key) => JSON.parse(localStorage.getItem(key) || '[]');
    const setStorage = (key, data) => localStorage.setItem(key, JSON.stringify(data));
    
    function renderLists() {
        if(!historyList) return;
        historyList.innerHTML = '';
        getStorage('history').reverse().forEach(q => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-regular fa-comment"></i> ${truncate(q, 25)}`;
            li.onclick = () => { questionInput.value = q; doSearch(); };
            historyList.appendChild(li);
        });
        savedList.innerHTML = '';
        getStorage('saved').reverse().forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-star"></i> ${truncate(s.q, 25)}`;
            li.onclick = () => {
                questionInput.value = s.q;
                resultsSection.classList.remove('hidden');
                echoText.textContent = s.q;
                answerBody.innerHTML = s.a;
                currentRecommendation = s.a;
                currentQuestion = s.q;
                retrievalInfo.classList.add('hidden');
                chunksContainer.innerHTML = '';
            };
            savedList.appendChild(li);
        });
    }
    renderLists();
    if(newChatBtn) newChatBtn.onclick = () => { questionInput.value = ''; resultsSection.classList.add('hidden'); };
    if(saveBtn) saveBtn.onclick = () => {
        if(!currentQuestion || !currentRecommendation) return;
        const saved = getStorage('saved');
        saved.push({ q: currentQuestion, a: currentRecommendation });
        setStorage('saved', saved);
        renderLists();
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
    };

    // ── Modals ──
    [document.getElementById('closeSimple'), document.getElementById('closePrep')].forEach(btn => {
        if(btn) btn.onclick = () => { simpleModal.classList.add('hidden'); prepModal.classList.add('hidden'); };
    });


    // ── Main Search ──
    async function doSearch() {
        const question = questionInput.value.trim();
        if (!question) return;

        safetyWarning.classList.add('hidden');
        resultsSection.classList.add('hidden');
        translationBox.classList.add('hidden');
        followUpsContainer.classList.add('hidden');
        transBtn.innerHTML = '<i class="fa-solid fa-language"></i> <span data-i18n="translate">Translate</span>';
        saveBtn.innerHTML = '<i class="fa-solid fa-star"></i> <span data-i18n="save">Save</span>';
        askBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        askBtn.disabled = true;

        // Save to history
        const hist = getStorage('history');
        if(!hist.includes(question)) { hist.push(question); setStorage('history', hist); renderLists(); }

        try {
            // 1. Precheck (Emergency / Scope)
            const preRes = await fetch('/api/precheck', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question })
            });
            if(preRes.ok) {
                const preData = await preRes.json();
                if(preData.emergency) {
                    safetyWarning.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <strong>Medical Emergency Detected:</strong> Please call emergency services immediately or go to the nearest hospital. This system cannot provide emergency care.';
                    safetyWarning.classList.remove('hidden');
                    askBtn.innerHTML = '<span class="btn-text" data-i18n="ask">Ask AI</span> <i class="fa-solid fa-arrow-right btn-arrow"></i>';
                    askBtn.disabled = false;
                    return; // STOP EXECUTION
                }
                if(preData.out_of_scope) {
                    safetyWarning.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> <strong>Out of Scope:</strong> Your question is not related to medicine or hypertension. The AI will not answer.';
                    safetyWarning.classList.remove('hidden');
                    askBtn.innerHTML = '<span class="btn-text" data-i18n="ask">Ask AI</span> <i class="fa-solid fa-arrow-right btn-arrow"></i>';
                    askBtn.disabled = false;
                    return; // STOP EXECUTION
                }
            }

            const animPromise = animatePipeline();
            const startTime = performance.now();

            const res = await fetch('/api/search', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }),
            });
            const data = await res.json();
            await animPromise;

            const endTime = performance.now();
            const diffSeconds = ((endTime - startTime) / 1000).toFixed(2);

            if (!res.ok) { alert(data.error || 'An error occurred.'); return; }

            currentQuestion = question;
            echoText.textContent = question;
            currentRecommendation = data.recommendation;
            answerBody.textContent = data.recommendation;
            evidenceQuote.textContent = data.evidence ? `"${data.evidence}"` : '';

            // Retrieval Info
            retrievalInfo.classList.remove('hidden');
            respTime.textContent = diffSeconds;
            
            const conf = (data.confidence || 'unknown').toLowerCase();
            confPill.className = 'confidence-pill';
            let confIcon = 'fa-check-circle';
            if (conf === 'high') { confPill.classList.add('conf-high'); confIcon = 'fa-check-double'; }
            else if (conf === 'medium') { confPill.classList.add('conf-med'); confIcon = 'fa-exclamation-circle'; }
            else if (conf === 'low') { confPill.classList.add('conf-low'); confIcon = 'fa-triangle-exclamation'; }
            else { confPill.classList.add('conf-insuf'); confIcon = 'fa-circle-xmark'; }
            confPill.innerHTML = `<i class="fa-solid ${confIcon}"></i> <span>${conf.toUpperCase()}</span>`;

            citationsList.innerHTML = '';
            let uniqueDocs = new Set();
            if (data.citations && data.citations.length > 0) {
                data.citations.forEach(c => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${c.document || 'Unknown'}</strong> — Section: ${c.section || 'N/A'}, Page: ${c.page || 'N/A'}`;
                    citationsList.appendChild(li);
                    uniqueDocs.add(c.document);
                });
            } else { citationsList.innerHTML = '<li style="color:var(--text-muted);">No citations available.</li>'; }

            srcCount.textContent = uniqueDocs.size;

            if(chunksContainer) {
                chunksContainer.innerHTML = '';
                if (data.retrieved_chunks && data.retrieved_chunks.length > 0) {
                    chunkCount.textContent = `(${data.retrieved_chunks.length} chunks)`;
                    data.retrieved_chunks.forEach((chunk, i) => {
                        const div = document.createElement('div');
                        div.className = 'chunk-card';
                        const simScore = (chunk.score * 100).toFixed(1) + '%';
                        div.innerHTML = `<div class="chunk-meta"><span>#${i + 1} — ${chunk.document}, Page ${chunk.page}</span><span class="chunk-score">Similarity: ${simScore}</span></div><div class="chunk-text">${truncate(chunk.text, 350)}</div>`;
                        chunksContainer.appendChild(div);
                    });
                } else {
                    chunksContainer.innerHTML = '<p class="muted">No chunks retrieved.</p>';
                }
            }

            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Fetch Followups in background
            fetch('/api/followup', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer: currentRecommendation })
            }).then(r => r.json()).then(fd => {
                if(fd.questions && fd.questions.length > 0) {
                    followUpsContainer.classList.remove('hidden');
                    followUpsList.innerHTML = '';
                    fd.questions.forEach(q => {
                        const b = document.createElement('button');
                        b.className = 'follow-up-btn';
                        b.textContent = q;
                        b.onclick = () => { questionInput.value = q; doSearch(); };
                        followUpsList.appendChild(b);
                    });
                }
            }).catch(()=>{});

        } catch (err) {
            alert('Failed to connect to the server.');
            resetPipeline();
        } finally {
            askBtn.innerHTML = '<span class="btn-text" data-i18n="ask">Ask AI</span> <i class="fa-solid fa-arrow-right btn-arrow"></i>';
            if (currentLang === 'ar') document.querySelector('[data-i18n="ask"]').textContent = translations['ar']['ask'];
            askBtn.disabled = false;
        }
    }

    function truncate(str, max) { return str && str.length > max ? str.substring(0, max) + '…' : (str||''); }
    askBtn.addEventListener('click', doSearch);
    questionInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    // ── Action Buttons ──
    if(copyBtn) copyBtn.addEventListener('click', () => {
        if (!currentRecommendation) return;
        navigator.clipboard.writeText(currentRecommendation).then(() => {
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => { copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span data-i18n="copy">${translations[currentLang]['copy'] || 'Copy'}</span>`; }, 2000);
        });
    });

    if(transBtn) transBtn.addEventListener('click', async () => {
        if (!currentRecommendation) return;
        transBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating...';
        transBtn.disabled = true;
        try {
            const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: currentRecommendation }) });
            const d = await r.json();
            if (r.ok) {
                translationBox.innerHTML = `<strong>الترجمة:</strong><br>${d.translated.replace(/\n/g, '<br>')}`;
                translationBox.classList.remove('hidden');
                transBtn.innerHTML = '<i class="fa-solid fa-check"></i> Translated';
            } else {
                transBtn.innerHTML = 'Failed (Quota?)';
                transBtn.disabled = false;
            }
        } catch (e) { transBtn.innerHTML = 'Error'; transBtn.disabled = false; }
    });

    if(simplifyBtn) simplifyBtn.addEventListener('click', async () => {
        if (!currentRecommendation) return;
        simpleText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating simple explanation...';
        simpleModal.classList.remove('hidden');
        try {
            const r = await fetch('/api/simplify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: currentRecommendation }) });
            const d = await r.json();
            if (r.ok) simpleText.innerHTML = d.simple.replace(/\n/g, '<br>');
            else simpleText.innerHTML = 'Failed to generate explanation. API Limit?';
        } catch (e) { simpleText.innerHTML = 'Error communicating with server.'; }
    });

    if(prepBtn) prepBtn.addEventListener('click', async () => {
        if (!currentRecommendation) return;
        prepText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing doctor questions...';
        prepModal.classList.remove('hidden');
        try {
            const r = await fetch('/api/doctor_prep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: currentQuestion, answer: currentRecommendation }) });
            const d = await r.json();
            if (r.ok) prepText.innerHTML = d.prep.replace(/\n/g, '<br>');
            else prepText.innerHTML = 'Failed to generate prep. API Limit?';
        } catch (e) { prepText.innerHTML = 'Error communicating with server.'; }
    });

    // Download PDF (html2pdf)
    if(pdfBtn) pdfBtn.addEventListener('click', () => {
        if (!currentRecommendation) return;
        const target = document.getElementById('answerContainer').cloneNode(true);
        // Remove action buttons from PDF
        const actions = target.querySelector('.answer-actions');
        if(actions) actions.remove();
        // Add Title and Disclaimer to PDF
        const title = document.createElement('h1');
        title.innerHTML = `Clinical Decision Report<br><small style="font-size: 14px; color: #555;">Generated by AI Clinical Prototype</small>`;
        title.style.color = 'black';
        target.prepend(title);
        target.style.background = 'white';
        target.style.color = 'black';
        target.style.padding = '30px';
        
        const opt = { margin: 0.5, filename: 'Clinical_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
        html2pdf().set(opt).from(target).save();
    });
});
