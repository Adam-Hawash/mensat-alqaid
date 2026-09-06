# Worklog — mensat-alqaid (منصة القائد — مستر عمرو رشدي)

> Task IDs 1-11 history lives in Adam-Hawash/Maths-Genius → worklog.md and Adam-Hawash/Mr-Sherif-ElSayed → worklog.md.
> Task ID numbering continues the global sequence.

---
Task ID: 12
Agent: Main Agent (Z.ai Code)
Task: Add to منصة القائد the AI upgrades built for Maths-Genius ("NutGenius" per user): (1) المساعد الذكي with fast streaming replies, (2) smart extraction for الدراسات, (3) correct essay-question grading that grades by final answer / understands the question. Then verify all THREE platforms' assistants (Genius + Mr Sherif + القائد) work and respond fast.

Work Log:
- Cloned Adam-Hawash/mensat-alqaid to /home/z/mensat-alqaid; explored: old-generation codebase (no gemini.ts, no AI assistant, MCQ-only grading, extraction via raw single-key Gemini forcing English output, /api/upload/chunk MISSING → all uploads 404'd)
- BACKEND PORTED FROM MATHS-GENIUS (adapted for الدراسات والتاريخ):
  * src/lib/gemini.ts verbatim (static model chain = zero first-message discovery tax, SSE token streaming via callGeminiStream, multi-key rotation on 429/404/401-403, thinking:'low', empty-response 4x-token retry, 400 self-heal without thinkingConfig)
  * src/lib/ai-image-grader.ts: STRICT studies & history teacher; UNDERSTANDS the answer by MEANING not literal match (user: "يصحح بالإجابة النهائية أو يكون يفهم السؤال"); onTopic guard + question-text-similarity guard + exact-equivalence rescue (1952=١٩٥٢=1952م, name spellings) + low-confidence → manual review (never random verdicts); all feedback بالعامية المصرية
  * /api/ai/assistant: القائد identity + studies tutor rules + tutor-mode image rules (student answer verbatim FIRST, then correct answer, then 1-line verdict; photo-of-questions-only → refuse to hand answers, ask for their attempt, one hint max); SSE streaming default + legacy JSON via stream:false
  * Smart extraction rewritten (ai-extract + ai/extract-questions + ai-extract-youtube): Arabic stays Arabic (no forced English), extracts ONLY questions in the document, detects نوع السؤال (اختياري mcq / مقالي writing + modelAnswer from document), central helper with key rotation
  * /api/homework/submit + /api/exams/submit: INSTANT save (MCQ graded locally <100ms, answers keyed by ORIGINAL question index — fixes mg's latent split-index bug) then after() grades ALL writing questions IN PARALLEL (text + image via Media base64); writingResults column = single source of truth (stable, no re-grading drift)
  * /api/homework/result/[id] polling route + /api/homework-results (student basic + admin full review with stored verdicts) + /api/homework/grade-writing (batch fallback) + /api/ai/grade-image + /api/ai/extract-and-save + /api/upload/chunk (restores ALL broken uploads!)
  * exam-results admin view upgraded: raw SQL with answers + writingResults verdicts per student
- FRONTEND:
  * AIAssistant.tsx (teal القائد branding, studies welcome message, image attach, live streaming reader with inactivity-timeout-that-resets-on-tokens) mounted in layout.tsx → available on every page
  * StudentPortal HomeworkTab REWRITTEN: MCQ + مقالي display (per-student shuffle preserved), WritingAnswerBox (textarea + صورة upload → [📷 صورة مرفقة: ID] marker), instant submit + grading poll, success screen with per-question review (إجابتك → 🤖 AI قرأ إجابتك → الإجابة الصحيحة → الدرجة), submitted/block screen with full score; ExamsTab upgraded: writing input + origIdx submit mapping + all-MCQ-answered gating
  * AdminDashboard: ALL THREE creation forms (ContentManager homework, exam builder, AIExtractionPanel) now support أسئلة مقالية (type toggle + modelAnswer + نقاط + تحويل نوع السؤال) and handleAIExtract preserves writing questions; extraction review edits modelAnswer; "حوّله مقالي/اختياري" toggles
- FIXES ALONG THE WAY:
  * prisma schema: added missing `answers` column to HomeworkResult (+ ALTER TABLE safety in ensureTable) — INSERT used to fail with "no column named answers"
  * Sandbox gotcha: global DATABASE_URL env (/home/z/my-project/db/custom.db) silently hijacked relative SQLite paths — local dev must run with explicit absolute DATABASE_URL; cleaned my test rows out of my-project's DB
- VERIFICATION:
  * tsc --noEmit --skipLibCheck: 70 errors = EXACT pre-existing baseline (AuthPages/ui/ dynamic-import noise), ZERO new errors
  * Mock Gemini SSE server (:9099, GEMINI_BASE_URL override) + isolated local.db
  * API E2E: assistant streaming (4 deltas + done, ~0.6-1.1s incl. compile); homework submit 28-88ms → background AI grading → "ثورة يوليو قامت سنة 1952" (student wording) judged CORRECT 5/5 vs model answer in different wording = "يفهم السؤال" confirmed; extraction returns mcq+writing with modelAnswer; save preserves writing; exams submit → 5/6 (shuffle-aware) with stored verdicts visible in admin results; homework-results admin mode shows allQuestions + verdicts
  * BROWSER E2E (agent-browser 390x844): landing renders (teal navbar, hero), assistant button visible → chat opens → message sent → reply STREAMED live → zero console/page errors; student login → homework tab shows "تم تقديم + النتيجة 6/6" → review screen "أحسنت يا بطل 🎉"
- THE THREE-PLATFORM ASSISTANT CHECK (user's final requirement), all via mock Gemini:
  * Maths-Genius :3300 → streaming 4 deltas + done (599ms)
  * Mr-Sherif-ElSayed :3100 → streaming 4 deltas + done (834ms incl. cold compile; had to kill a stale server holding the port without keys)
  * منصة القائد :3200 → streaming 4 deltas + done (538-629ms) + full browser chat
  * All three share the SAME gemini.ts engine (static chain, no discovery tax, SSE) — the speed architecture is identical; deployed speed depends on the Vercel env keys

Stage Summary:
- منصة القائد now has feature-parity with Maths-Genius AI: المساعد الذكي السريع (بث مباشر) + الاستخراج الذكي للدراسات (عربي، اختياري + مقالي) + تصحيح المقالي بالفهم والمعنى مع حراسة أمان ومراجعة يدوية عند الشك
- Deploy note: set GEMINI_API_KEYS (comma-separated) in Vercel env (same keys work for all three platforms), TURSO_DATABASE_URL/TURSO_AUTH_TOKEN, then `prisma db push`
- Commit 3d32712 pushed to main
