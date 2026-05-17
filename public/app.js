/* app.js — Fracture Studio core analysis logic */
(function () {
  'use strict';

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const essayInput      = document.getElementById('essayInput');
  const charCount       = document.getElementById('charCount');
  const analyzeBtn      = document.getElementById('analyzeBtn');
  const clearBtn        = document.getElementById('clearBtn');
  const saveBtn         = document.getElementById('saveBtn');
  const loadBtn         = document.getElementById('loadBtn');
  const statusDot       = document.getElementById('statusDot');
  const statusLabel     = document.getElementById('statusLabel');
  const statusDetail    = document.getElementById('statusDetail');
  const progressPill    = document.getElementById('progressPill');
  const progressBar     = document.getElementById('progressBar');
  const jsonOutput      = document.getElementById('jsonOutput');
  const jsonError       = document.getElementById('jsonError');
  const scorePill       = document.getElementById('scorePill');
  const copyBtn         = document.getElementById('copyBtn');
  const exportBtn       = document.getElementById('exportBtn');
  const shareBtn        = document.getElementById('shareBtn');
  const reportContainer = document.getElementById('reportContainer');
  const skeleton        = document.getElementById('skeleton');

  if (!essayInput) return; // Not on studio page

  // ── State ──────────────────────────────────────────────────────────────────
  let rawJsonText   = '';
  let isStreaming   = false;
  let progress      = 0;
  let progressTimer = null;

  const STORAGE_KEY_ESSAY = 'fracture_studio_last_essay';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function updateCharCount() {
    charCount.textContent = essayInput.value.length.toLocaleString() + ' chars';
  }

  function setStatus(mode, detail) {
    statusDot.classList.remove('live', 'error');
    if (mode === 'live')       { statusDot.classList.add('live');  statusLabel.textContent = 'Streaming'; }
    else if (mode === 'error') { statusDot.classList.add('error'); statusLabel.textContent = 'Error'; }
    else if (mode === 'done')  { statusLabel.textContent = 'Complete'; }
    else                       { statusLabel.textContent = 'Idle'; }
    if (statusDetail) statusDetail.textContent = detail;
  }

  function setProgress(value) {
    progress = Math.max(0, Math.min(100, value));
    if (progressPill) progressPill.textContent = String(Math.floor(progress)).padStart(2, ' ') + '%';
    if (progressBar)  progressBar.style.width  = progress + '%';
  }

  function startProgress() {
    setProgress(3);
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(function () {
      if (!isStreaming) return;
      if (progress < 90) setProgress(progress + 2.5);
    }, 500);
  }

  function stopProgress(success) {
    if (progressTimer) clearInterval(progressTimer);
    setProgress(success ? 100 : progress);
  }

  function resetOutput() {
    rawJsonText = '';
    if (jsonOutput) jsonOutput.textContent = '';
    if (jsonError)  { jsonError.classList.add('hidden'); jsonError.textContent = ''; }
    if (scorePill)  scorePill.textContent = '—';
    if (copyBtn)    copyBtn.disabled  = true;
    if (exportBtn)  exportBtn.disabled = true;
    if (shareBtn)   shareBtn.disabled  = true;
    if (reportContainer) { reportContainer.innerHTML = ''; reportContainer.classList.remove('visible'); }
    if (skeleton)   skeleton.classList.add('hidden');
    setProgress(0);
  }

  function setBtns(disabled) {
    [analyzeBtn, clearBtn, saveBtn, loadBtn].forEach(function (b) {
      if (b) b.disabled = disabled;
    });
  }

  // ── Escape HTML ────────────────────────────────────────────────────────────
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function quoteBlock(text) {
    return '<div class="report-quote">' + esc(text || '') + '</div>';
  }

  // ── Report renderer ────────────────────────────────────────────────────────
  function renderReport(parsed) {
  const c = reportContainer;
  c.innerHTML = '';

  function section(title, innerHTML, open) {
    return '<details class="report-section"' + (open ? ' open' : '') + '>' +
           '<summary>' + title + '</summary>' +
           '<div class="content">' + innerHTML + '</div>' +
           '</details>';
  }

  // --- 1. VERDICT & SCORE BREAKDOWN ---
  const scores = parsed.score_breakdown || {};
  const defs = parsed.user_facing_rubric_definitions || {};
  
  const scoreSection = 
    '<p>' + esc(parsed.verdict || '') + '</p>' +
    '<div class="score-grid">' +
      '<div class="score-chip-expanded">' +
        '<div class="score-chip-header">Fact & Evidence Strength <span>' + (scores.fact_and_evidence_strength?.score ?? '—') + '/25</span></div>' +
        '<div class="score-definition">' + esc(defs.fact_and_evidence_strength || '') + '</div>' +
        '<div class="score-reasoning"><b>Why you got this score:</b> ' + esc(scores.fact_and_evidence_strength?.why_you_got_this_score || '') + '</div>' +
      '</div>' +
      '<div class="score-chip-expanded">' +
        '<div class="score-chip-header">Logical Correctness <span>' + (scores.logical_correctness?.score ?? '—') + '/25</span></div>' +
        '<div class="score-definition">' + esc(defs.logical_correctness || '') + '</div>' +
        '<div class="score-reasoning"><b>Why you got this score:</b> ' + esc(scores.logical_correctness?.why_you_got_this_score || '') + '</div>' +
      '</div>' +
      '<div class="score-chip-expanded">' +
        '<div class="score-chip-header">Rhetoric & Writing Style <span>' + (scores.rhetoric_and_writing_style?.score ?? '—') + '/25</span></div>' +
        '<div class="score-definition">' + esc(defs.rhetoric_and_writing_style || '') + '</div>' +
        '<div class="score-reasoning"><b>Why you got this score:</b> ' + esc(scores.rhetoric_and_writing_style?.why_you_got_this_score || '') + '</div>' +
      '</div>' +
      '<div class="score-chip-expanded">' +
        '<div class="score-chip-header">Clarity & Flow <span>' + (scores.clarity_and_flow?.score ?? '—') + '/25</span></div>' +
        '<div class="score-definition">' + esc(defs.clarity_and_flow || '') + '</div>' +
        '<div class="score-reasoning"><b>Why you got this score:</b> ' + esc(scores.clarity_and_flow?.why_you_got_this_score || '') + '</div>' +
      '</div>' +
    '</div>';

  // --- 2. THESIS DEEP DIVE ---
  const deepDive = parsed.evidence_deep_dive || {};
  const thesis = deepDive.thesis_audit || {};
  const thesisSection = 
    '<div class="report-item">' +
      '<span class="report-label">Thesis Statement Evaluated:</span>' + 
      quoteBlock(thesis.quote) +
      '<p><b>Claim Classification:</b> ' + esc(thesis.core_claim_type || '—') + '</p>' +
      '<p><b>Falsifiability Metric:</b> ' + esc(thesis.falsifiability_check || '') + '</p>' +
      '<p><b>Strategic Vulnerability:</b> ' + esc(thesis.structural_vulnerability || '') + '</p>' +
    '</div>';

  // --- 3. CLAIM-BY-CLAIM AUDIT (5-TIER MATCHING) ---
  const claimsSection = (deepDive.body_claims_analysis || []).map(function (cl) {
    return '<div class="report-item">' +
           '<span class="report-label">Claim:</span>' + quoteBlock(cl.quote) +
           '<p><b>Evidence Rating:</b> <span class="rating-badge ' + esc(cl.evidence_rating || '').toLowerCase() + '">' + esc((cl.evidence_rating || '—').replace(/_/g, ' ')) + '</span></p>' +
           '<p><b>Diagnosis:</b> ' + esc(cl.diagnosis || '') + '</p>' +
           '<p><b>Opponent Exploit:</b> ' + esc(cl.opponent_exploit || '') + '</p>' +
           '<p><b>Fix:</b> ' + esc(cl.fix || '') + '</p>' +
           '</div>';
  }).join('') || '<p>No claims parsed.</p>';

  // --- 4. HIDDEN ASSUMPTIONS FOUND (5-TIER MATCHING) ---
  const assumptionsSection = (parsed.hidden_assumptions_found || []).map(function (a) {
    return '<div class="report-item">' +
           '<p><b>Hidden Implicit Assumption:</b> ' + esc(a.assumption || '') + '</p>' +
           '<p><b>Thesis Danger Level:</b> <span class="danger-badge ' + esc(a.danger_level || '').toLowerCase() + '">' + esc((a.danger_level || '—').replace(/_/g, ' ')) + '</span></p>' +
           '<span class="report-label">Dependent Content:</span>' + quoteBlock(a.quote) +
           '<p><b>Vulnerability Analysis:</b> ' + esc(a.vulnerability || '') + '</p>' +
           '<p><b>Structural Defense Strategy:</b> ' + esc(a.defense || '') + '</p>' +
           '</div>';
  }).join('') || '<p>No unspoken assumptions flagged.</p>';

  // --- 5. LOGICAL FALLACIES ---
  const fallaciesSection = (parsed.logical_fallacies || []).map(function (f) {
    return '<div class="report-item">' +
           '<p><b>' + esc(f.name || 'Logical Fallacy') + '</b></p>' + 
           quoteBlock(f.quote) +
           '<p><b>Breakdown:</b> ' + esc(f.explanation || '') + '</p>' +
           '<p><b>Rational Correction:</b> ' + esc(f.fix || '') + '</p>' +
           '</div>';
  }).join('') || '<p>No explicit structural fallacies flagged.</p>';

  // --- 6. COUNTER-ARGUMENTS TO PREPARE FOR ---
  const countersSection = (parsed.counter_arguments_to_prepare_for || []).map(function (ct) {
    return '<div class="report-item">' +
           '<p><b>Opposing Viewpoint (Steelman):</b> ' + esc(ct.opposing_viewpoint_steelman || '') + '</p>' +
           '<span class="report-label">Targeted Section:</span>' + quoteBlock(ct.targets) +
           '<p><b>Structural Damage Potential:</b> ' + esc(ct.damage || '') + '</p>' +
           '<p><b>Suggested Rebuttal Setup:</b> ' + esc(ct.suggested_rebuttal || '') + '</p>' +
           '</div>';
  }).join('') || '<p>No systemic counter-arguments generated.</p>';

  // --- 7. RHETORICAL & STYLISTIC ANALYSIS ---
  const rhet = parsed.rhetorical_and_stylistic_analysis || {};
  const rhetoricSection = 
    '<p><b>Opening Hook Assessment:</b> ' + esc(rhet.opening_hook_evaluation || '') + '</p>' +
    '<p><b>Logical Progression & Cognitive Pacing:</b> ' + esc(rhet.logical_progression || '') + '</p>' +
    '<p><b>Most Persuasive / Stylistic Sentence:</b></p>' + 
    quoteBlock((rhet.strongest_sentence || {}).quote) +
    '<p><b>Linguistic Analysis:</b> ' + esc((rhet.strongest_sentence || {}).why || '') + '</p>' +
    '<p><b>Most Awkward / Wordy Sentence:</b></p>' + 
    quoteBlock((rhet.weakest_sentence || {}).quote) +
    '<p><b>Stylistic Failure:</b> ' + esc((rhet.weakest_sentence || {}).why || '') + '</p>' +
    '<p><b>Optimized Rewrite:</b> ' + esc((rhet.weakest_sentence || {}).fix || '');

  // --- 8. WEIGHING ENGINE (DECISION SUPER-ENGINE) ---
  const engine = parsed.weighing_engine || {};
  const dims = engine.weighing_dimensions || {};
  
  function renderDimensionArray(arr) {
    return (arr || []).map(function(item) { return '<li>' + esc(item) + '</li>'; }).join('');
  }

  const weighingSection = 
    '<div class="weighing-engine-container">' +
      '<p class="engine-meta"><i>' + esc(engine.system_prompt || '') + '</i></p>' +
      '<p><b>Evaluated Elements:</b> ' + esc(engine.input_evaluated || '') + '</p>' +
      
      '<div class="engine-dimensions-grid">' +
        '<div class="dim-block"><h5>⚖️ Magnitude</h5><ul>' + renderDimensionArray(dims.magnitude) + '</ul></div>' +
        '<div class="dim-block"><h5>🎲 Probability</h5><ul>' + renderDimensionArray(dims.probability) + '</ul></div>' +
        '<div class="dim-block"><h5>⏳ Timeframe</h5><ul>' + renderDimensionArray(dims.timeframe) + '</ul></div>' +
        '<div class="dim-block"><h5>🌐 Scope</h5><ul>' + renderDimensionArray(dims.scope) + '</ul></div>' +
      '</div>' +

      '<div class="engine-analysis">' +
        '<h4>Comparative Clash Analysis</h4>' +
        '<p>' + esc(engine.comparative_analysis || '') + '</p>' +
      '</div>' +

      '<div class="engine-winner-box">' +
        '<p><b>🏆 Dominant Impact Winner:</b> <span class="winner-highlight">' + esc(engine.winner || '') + '</span></p>' +
        '<p><b>Systemic Reasoning:</b> ' + esc(engine.final_impact_reasoning || '') + '</p>' +
      '</div>' +
    '</div>';

  // --- APPEND ALL SECTIONS TO CONTAINER ---
  c.innerHTML = 
    section('Verdict & Score Breakdown', scoreSection, true) +
    section('Thesis Diagnostic', thesisSection) +
    section('Claim-by-Claim Audit', claimsSection) +
    section('Implicit Assumption Analysis', assumptionsSection) +
    section('Structural Fallacies', fallaciesSection) +
    section('Counter-Argument Preparedness', countersSection) +
    section('Rhetorical Style Analysis', rhetoricSection) +
    section('⚖️ Comparative Impact Weighing Engine', weighingSection);

  requestAnimationFrame(function () {
    c.classList.add('visible');
  });
}


  // ── Core analysis ──────────────────────────────────────────────────────────
  async function runAnalysis() {
    const essay = essayInput.value.trim();
    if (!essay) { setStatus('error', 'Paste an essay before running the audit.'); return; }

    resetOutput();
    isStreaming = true;
    setBtns(true);
    if (skeleton) skeleton.classList.remove('hidden');
    setStatus('live', 'Running full argument audit…');
    startProgress();

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay: essay }),
      });

      if (!response.ok) {
        const err = await response.json().catch(function () { return { error: response.statusText }; });
        throw new Error(err.error || response.statusText);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let   buffer  = '';
      if (jsonOutput) jsonOutput.textContent = '';
      rawJsonText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json  = JSON.parse(data);
            const delta = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || '';
            if (delta) {
              rawJsonText += delta;
              if (jsonOutput) jsonOutput.textContent += delta;
            }
          } catch (_) { /* ignore malformed SSE chunks */ }
        }
      }

      isStreaming = false;
      setBtns(false);
      if (copyBtn)   copyBtn.disabled   = false;
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      stopProgress(true);
      if (skeleton) skeleton.classList.add('hidden');

      try {
        const parsed = JSON.parse(rawJsonText);
        setStatus('done', 'Audit complete. JSON is valid.');
        if (typeof parsed.overall_score === 'number' && scorePill) {
          scorePill.textContent = String(parsed.overall_score);
        }
        renderReport(parsed);
      } catch (e) {
        setStatus('error', 'Model response is not valid JSON. Check for stray text or truncation.');
        if (jsonError) {
          jsonError.classList.remove('hidden');
          jsonError.textContent = 'Parse error: ' + e.message;
        }
      }

    } catch (err) {
      isStreaming = false;
      setBtns(false);
      stopProgress(false);
      if (skeleton) skeleton.classList.add('hidden');
      setStatus('error', 'Request failed. Check your connection or server configuration.');
      if (jsonError) {
        jsonError.classList.remove('hidden');
        jsonError.textContent = 'Request error: ' + (err && err.message ? err.message : String(err));
      }
    }
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────
  async function copyJson() {
    if (!rawJsonText) return;
    try {
      await navigator.clipboard.writeText(rawJsonText);
      if (statusDetail) statusDetail.textContent = 'JSON copied to clipboard.';
    } catch (_) {
      if (statusDetail) statusDetail.textContent = 'Unable to copy to clipboard.';
    }
  }

  function exportJson() {
    if (!rawJsonText) return;
    const blob = new Blob([rawJsonText], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'fracture_analysis.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function shareLink() {
    if (!rawJsonText) return;
    const url = location.origin + location.pathname + '?analysis=' + encodeURIComponent(rawJsonText);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(function () { if (statusDetail) statusDetail.textContent = 'Share link copied to clipboard.'; })
        .catch(function () { history.replaceState(null, '', url); if (statusDetail) statusDetail.textContent = 'Share link placed in the address bar.'; });
    } else {
      history.replaceState(null, '', url);
      if (statusDetail) statusDetail.textContent = 'Share link placed in the address bar.';
    }
  }

  function clearAll() {
    if (isStreaming) return;
    essayInput.value = '';
    updateCharCount();
    resetOutput();
    setStatus('idle', 'Waiting for an essay.');
  }

  function saveEssay() {
    const essay = essayInput.value.trim();
    if (!essay) { if (statusDetail) statusDetail.textContent = 'Nothing to save.'; return; }
    try { localStorage.setItem(STORAGE_KEY_ESSAY, essay); if (statusDetail) statusDetail.textContent = 'Essay saved locally.'; }
    catch (_) { if (statusDetail) statusDetail.textContent = 'Unable to save.'; }
  }

  function loadEssay() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ESSAY);
      if (!saved) { if (statusDetail) statusDetail.textContent = 'No saved essay found.'; return; }
      essayInput.value = saved; updateCharCount();
      if (statusDetail) statusDetail.textContent = 'Saved essay loaded.';
    } catch (_) { if (statusDetail) statusDetail.textContent = 'Unable to load.'; }
  }

  // ── Shared-link loader ─────────────────────────────────────────────────────
  function maybeLoadSharedAnalysis() {
    const analysis = new URLSearchParams(location.search).get('analysis');
    if (!analysis) return;
    try {
      rawJsonText = decodeURIComponent(analysis);
      if (jsonOutput) jsonOutput.textContent = rawJsonText;
      const parsed = JSON.parse(rawJsonText);
      if (typeof parsed.overall_score === 'number' && scorePill) scorePill.textContent = String(parsed.overall_score);
      renderReport(parsed);
      if (copyBtn)   copyBtn.disabled   = false;
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      if (statusLabel)  statusLabel.textContent  = 'Loaded';
      if (statusDetail) statusDetail.textContent = 'Analysis loaded from shared link.';
    } catch (_) { /* ignore invalid shared payload */ }
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  essayInput.addEventListener('input', updateCharCount);
  analyzeBtn.addEventListener('click', runAnalysis);
  if (clearBtn)  clearBtn.addEventListener('click',  clearAll);
  if (copyBtn)   copyBtn.addEventListener('click',   copyJson);
  if (exportBtn) exportBtn.addEventListener('click', exportJson);
  if (shareBtn)  shareBtn.addEventListener('click',  shareLink);
  if (saveBtn)   saveBtn.addEventListener('click',   saveEssay);
  if (loadBtn)   loadBtn.addEventListener('click',   loadEssay);

  // ── Init ───────────────────────────────────────────────────────────────────
  updateCharCount();
  setStatus('idle', 'Waiting for an essay.');
  setProgress(0);
  if (skeleton) skeleton.classList.add('hidden');
  maybeLoadSharedAnalysis();

})();
