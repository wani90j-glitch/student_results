# خطة نقل منصة «إتقان» إلى تطبيق ويب مستضاف — PLAN.md

> الجزء الأول بالعربية للمعلمة (ما الذي سيُبنى، والقرارات المطلوبة منك).
> الجزء الثاني تقني بالإنجليزية (نموذج البيانات، الصلاحيات، الصفحات، قائمة التحقق) ليرجع إليه أي مبرمج لاحقًا.

---

## الجزء الأول: ملخص للمعلمة

### اسم الموقع
- اسم الموقع **Itqan**: يكون اسم المشروع في Vercel `itqan`، فيصبح الرابط `itqan.vercel.app` إن كان متاحًا. إن كان محجوزًا نختار أقرب بديل مثل `itqan-edu.vercel.app`، ويمكن لاحقًا ربط نطاق خاص مثل `itqan.sa`.
- عنوان الصفحة في المتصفح: «Itqan | إتقان».


### 🎯 أهداف المنصة الستة (طلب المعلمة 2026-11-24) وكيف تتحقق
| الهدف | ما يحققه في المنصة |
|---|---|
| 1. التقويم الأكاديمي القائم على الأدلة | كل سؤال مربوط بمهارة (ناتج تعلّم) ومستوى معرفي من إطار تيمز. الإتقان يُحسب لكل مهارة ومستوى وطالبة وفصل. التقويم الختامي: اختبارات الفترة والنهائي. التقويم التكويني: اختبارات التحسين والمهام الأدائية. صفحة «الجودة والاعتماد» تعرض مؤشرات الأداء الرئيسة مع المستهدفات. |
| 2. دعم القرارات التدريسية | «ملخص القرار»: الأقل والأكثر إتقانًا من المهارات والمستويات والطالبات، مع الإجراء المقترح. اقتراح أسلوب شرح بالذكاء الاصطناعي. خطط علاجية وإثرائية فردية. مواءمة الاختبار مع نواتج التعلم في «جدول المواصفات». |
| 3. ضمان الجودة | مؤشرات قابلة للقياس مع مستهدفات (محك الإتقان، نسبة المتقنات، الثبات). المتابعة عبر الاختبارات (الاتجاهات). المقارنة بمعيار مرجعي تدخله المعلمة، مثل نافس أو متوسط الإدارة. تقرير مجمَّع بلا أسماء للطباعة. |
| 4. متطلبات الاعتماد | سجل تعديلات لا يُحذف (من غيّر ماذا ومتى). توثيق ممارسات التقويم بالأعداد. المواءمة مع نواتج التعلم وتغطيتها. كشوف رسمية: «كشف الدرجات بعد التحسين» و«نتائج تصحيح اختبار التحسين» مع الأوراق المصحَّحة. سجل اطلاع أولياء الأمور. |
| 5. صدق الاختبارات وثباتها | تحليل البدائل (من الإجابات المحفوظة). جودة كل سؤال محفوظة في البنك عبر الاختبارات، والاختيار التلقائي يقدّم الأسئلة ذات الجودة المثبتة. تحليل الأسئلة: السهولة، والتمييز (27% العليا والدنيا)، والارتباط بالدرجة، والثبات لو حُذف السؤال. معامل الثبات (ألفا كرونباخ / KR-20) والخطأ المعياري للقياس. صدق المحتوى: توزيع المستويات المعرفية مقابل نسب تيمز، وتغطية المهارات. |
| 6. التخطيط الاستراتيجي | بيانات تراكمية: اتجاه الإتقان قبل التحسين وبعده لكل اختبار ومستوى معرفي وفصل، برسم وجدول. **لم يُبنَ بعد** مستوى القسم والمدرسة (عدة معلمات ودور «قائدة/مشرفة»)؛ قاعدة البيانات جاهزة له (school_id في كل صف)، وينتظر قرار المعلمة. |

### ما الذي سيتغيّر؟
- المنصة الحالية ملف HTML واحد يحفظ البيانات داخل Claude. الجديدة **موقع مستقل** على Vercel برابط ثابت، وبياناته في قاعدة بيانات آمنة على Supabase.
- **الشكل لن يتغيّر**: الألوان نفسها، وخط Readex Pro، والاتجاه من اليمين لليسار، والشاشات والعبارات نفسها.
- **دخول المعلمة**: بريد إلكتروني وكلمة مرور، ويمكن إضافة رمز تحقق من تطبيق في الجوال (خطوتان).
- **دخول الطالبة ووليّ الأمر**: «الرقم السري» كما هو اليوم. لكن قاعدة البيانات لن تحفظ الرقم نفسه، بل «بصمة» مشفّرة منه لا يمكن استرجاع الرقم منها.
- **صفحة الطالبة للمعلمة**: زر «صفحة الطالبة» يفتح الصفحة كما تراها الطالبة تمامًا، مع زرَّي «طالبة أخرى» و«عودة إلى صفحة المعلمة».
- **الصلاحيات من قاعدة البيانات نفسها**: الطالبة لا تستطيع تقنيًا قراءة بيانات غيرها، والمعلمة لا ترى إلا فصولها.

### كل ما وجدته في الكود الحالي وسأنقله
الرئيسية ولوحة المتابعة، والإنذار المبكر، و«الحصة الآن» مع الجدول الدراسي ونجوم الطالبات والمجموعات، والطالبات، والمهارات، وبنك الأسئلة (8 أنواع)، والاختبارات وأوراقها PDF وجدول المهارات وأوراق الإجابة (مربعات ودوائر)، والتصحيح (يدويًا أو بملف إكسل أو بالتصوير)، والتحليل وملخص القرار والتوزيع الطبيعي، وفجوة الأداء بمحكّاتها الثلاثة، واختبارات التحسين بجولاتها المتعددة، وأولياء الأمور والإرسال، والمهام الأدائية، والسلوك، وبيانات المدرسة، والعربية والإنجليزية، والجولة التعريفية.

### ✅ قرارات المعلمة (2026-11-24)
1. المستودع **خاص (Private) الآن** مؤقتًا حتى التأكد من التشغيل، ثم قد يصبح عامًا لاحقًا. لذلك لا تُرفع بيانات حقيقية إلى GitHub في أي وقت.
2. الرقم السري للطالبة = **رقم الهوية** كما هو اليوم، ويُحفظ مشفّرًا فقط (بصمة HMAC مع مفتاح سري خارج قاعدة البيانات + scrypt)، ولا يُحفظ الرقم نفسه ولا جزء منه.
3. تُنقل **ميزات الذكاء الاصطناعي الثماني كلها**.
4. المعلمة سترفع صور أوراق الإجابة بنفسها.
5. **لا يُكتب «حجم الأثر» (d) في أي مكان.** يُعرض بدلًا منه **الانحراف المعياري SD** قبل التحسين وبعده، محسوبًا من البيانات.

### (للأرشيف) القرارات كما طُرحت

**1) مستودع GitHub عام (Public) الآن.** أي شخص في الإنترنت يستطيع قراءة الكود. لن أضع فيه أي بيانات طالبات أبدًا، لكني أنصح بشدة أن تجعليه **خاصًا (Private)**. إن وافقتِ فهذه خطوة واحدة سأشرحها لك. ولن أرفع ملف `itqan-source.html` إلى المستودع قبل أن يصبح خاصًا، لأن فيه اسمك واسم المدرسة وشعارها.

**2) الرقم السري للطالبات.** اليوم رقم الهوية الوطنية هو نفسه الرقم السري. أمامنا خياران:
- **(أ) أنصح به:** أرقام سرية جديدة من 6 خانات لكل طالبة. تطبعين بطاقة لكل واحدة من صفحة «الطالبات»، ولا يبقى أي أثر لرقم الهوية في النظام.
- (ب) الإبقاء على رقم الهوية رقمًا سريًا، فلا تحتاج الطالبات إلى رقم جديد، ويُحفظ «مشفّرًا». لكن عيبه أن أرقام الهوية معروفة الشكل، فتخمينها أسهل، والأحوط ألّا نحتفظ بأي أثر لها.

**3) ميزات الذكاء الاصطناعي.** ذكرتِ ميزتين، لكن الكود الحالي فيه **ثماني** ميزات: اقتراح المهمة الأدائية، وتقييم ما تسلّمه الطالبة، واقتراح أسلوب شرح للمهارة الضعيفة، والخطة العلاجية المقترحة، وتصحيح أوراق الإجابة بالتصوير، وقراءة الأسئلة من صورة أو PDF، وتوليد سؤال مكافئ واقتراح مهارة السؤال، وقراءة الجدول الدراسي من صورة. اقتراحي: أنقلها كلها، كلٌّ في خطوة مستقلة، وتبدأ المهمة الأدائية أولًا.

**4) صور أوراق الإجابة الممسوحة.** ملف البيانات (JSON) يحتوي فقط على **أرقام تعريف** الصور، لا الصور نفسها، لأنها محفوظة داخل Claude. لننقلها نحتاج أحد أمرين: أن ترسلي لي رابط المنصة الحالية في Claude فأحاول سحب الصور منه، أو أن تعيدي رفع ملفات الأوراق من جهازك. ويسري الأمر نفسه على ما سلّمته الطالبات من مهام أدائية، إن وُجد.

**5) حجم الأثر (d = 0.83).** في الصفحة الأولى رقم ثابت مكتوب يدويًا، ولا يحسبه الكود. سأضيف حسابه الفعلي من البيانات. أي طريقة استعملتِ في بحثك: (أ) **المقارنة المزدوجة** لنفس الطالبات قبل وبعد (d_z)؟ أم (ب) **الانحراف المعياري المجمّع** (Cohen's d الكلاسيكي)؟ إن لم تتذكري، أحسب الطريقتين على بياناتك وأختار التي تعطي 0.83 وأكتب ذلك لك.

### ترتيب العمل (بعد موافقتك)
1. هيكل المشروع (Next.js + Tailwind + الخط والألوان) ونقل دوال الحساب مع اختبارات تقارنها بالمنصة القديمة.
2. قاعدة البيانات والصلاحيات (RLS) وسكربت نقل البيانات.
3. دخول المعلمة والطالبة ومعاينة صفحة الطالبة.
4. صفحات المعلمة بالترتيب: الطالبات، المهارات، البنك، الاختبارات وPDF، التصحيح، التحليل، الفجوة، التحسين، أولياء الأمور، السلوك، الحصة الآن، المدرسة.
5. صفحة الطالبة ووليّ الأمر كاملة.
6. أوراق الإجابة الممسوحة (تخزين خاص وروابط مؤقتة).
7. ميزات الذكاء الاصطناعي.
8. النشر على Vercel، ثم تعليمات خطوة بخطوة لك بالعربية.

بعد كل خطوة: حفظ (commit) وسطر في `CHANGELOG.md` بالعربية.

---

## Part 2 — Technical plan (English)

### 0. What the source app is (findings from reading `itqan-source.html`)
- ~2,700 lines; one inline script. `const DATA` (line 274) ships seed content: 88 skills, 105 bank questions, Form A (20 q), written form (20 q), seed question images (`qimg`), two logos. No student data in the source file.
- Storage abstraction `Store` (Claude artifact DB or localStorage) with document paths:
  `itqan/settings`, `itqan/skills`, `itqan/bank`, `people/roster`, `tests/<id>`, `improve/<id>`, `acks/<sid>`, `sheets/<key>`, `qimg/<id>`, `behavior/log`, `behavior/stars`, `private/auth`.
- The JSON export (`A.exportAll`) contains: `settings, skills, bank, roster, tests, improve, acks, sheets, qimg, behavior` — **not** `stars` or the teacher password (`stars` must be pulled separately or reset; to confirm when the file arrives).
- One-off legacy loaders (`importReal`, `REAL_QS`, `applyTests`, `fixRealQs`, `readStage`, `importSheetMap`, `FILE_SHEETS`, `SHEETDATA`, demo builder, `seedVer`/`lvlFix1` upgrades) are **not ported**: their effect is already materialised in the export.
- Core maths (to port verbatim into `lib/calc/*`, pure TS functions):
  `pct` (1-dp rounding), `band` (<50 low, <80 mid, else high), `qMax`, `testMax`, `studentStats` (per-skill correct + recovered marks from improvement rounds, capped at skill total; levels K/A/R), `groupStats`, `roundScores` (scores after each improvement round k), `buildImprovement` (seeded RNG `seededRand(len*7919 + nResults)`, crit `lost|80|50`, unseen questions first), `risk` (early-warning points), `gapTarget/gapOf/gapSkills/gapCompare` (crit % / class mean / all-classes mean; `gapCls` thresholds 0 and −15), `distChart` stats (mean, population SD, normal pdf), `dashData`, `decisionCard` selections, `buildPlan` (rule-based remedial/enrichment text), `taskBase`, `markOf` (Arabic/Latin answer normalisation), `aiAcc`.
- Effect size is **not shown anywhere** (teacher's decision). The landing page's hard-coded `d = 0.83` tile is replaced by the **standard deviation (SD) before → after improvement**, computed live with the same population SD used by `distChart`; `79% → 91%` and `96%` also become live numbers (`lib/calc/summary.ts`).

### 1. Stack
- Site/app name: **Itqan** — Vercel project `itqan` (URL `itqan.vercel.app`, fallback `itqan-edu.vercel.app` if taken), npm package `itqan`, `<title>` «Itqan | إتقان», PWA manifest name `Itqan`.
- Next.js 15 (App Router, TypeScript, Server Components + Server Actions), Tailwind CSS 4, the source CSS tokens ported as CSS variables (colours `--low/--mid/--high/--gold/--line/--muted`…), Readex Pro self-hosted via `next/font/local` (same woff2 subsets that are embedded in the source).
- Supabase: Postgres + Auth + Storage + RLS; `@supabase/ssr` for cookie sessions.
- Anthropic API via `@anthropic-ai/sdk`, server-only (`ANTHROPIC_API_KEY`), model id from env `ITQAN_AI_MODEL` (default: current Sonnet), JSON outputs validated with zod.
- PDF papers: keep the source canvas→jsPDF engine client-side (browser shapes Arabic correctly; works offline). Port `newDoc/text/wrap/header/paperQuestion/docPaper/docSpec/docSheets/docImprove/docDash` into `lib/pdf/*`.
- Roster/Excel/AI-grading matching by national ID uses the same HMAC (`pin_lookup`), so the ID never needs to be stored.
- Excel: SheetJS (`xlsx`) client-side for roster and results import.
- Tests: Vitest (unit + parity), Playwright (smoke: login, student page, iPhone viewport).
- Hosting: Vercel (HTTPS only, HSTS), region close to KSA (`fra1`/`me-central` if available); Supabase project region `eu-central-1` or `me-central-1` if offered (PDPL: prefer in-region; document the choice).

### 2. Data model (Postgres)
Every row carries `school_id` and (where owned) `teacher_id` for future multi-teacher/multi-school use. Text primary keys are kept for imported entities so original IDs survive (`s0011jmg`, `t_p1_1448`, `m_p1_1448`, `q001`, `s001`).

| table | key columns | notes |
|---|---|---|
| `schools` | `id uuid`, `name`, `region`, `logo_path`, `logo2_path` | header data for PDFs |
| `teachers` | `id uuid = auth.users.id`, `school_id`, `display_name`, `subject`, `grade`, `term`, `year`, `pfont`, `settings jsonb` | `settings`: gap cfg, timetable `tt`, groups, aiLog, lang |
| `subjects` | `id text`, `school_id`, `name`, `grade` | `sci9` |
| `classes` | `id uuid`, `school_id`, `teacher_id`, `name` ("3/1") | from roster `cls` |
| `students` | `id text`, `school_id`, `teacher_id`, `class_id`, `seat_no` (old `no`), `name`, `pin_lookup bytea unique`, `pin_hash text`, `auth_user_id uuid`, `stars int` | **no national ID column** |
| `skills` | `id text`, `school_id`, `teacher_id`, `subject_id`, `chapter`, `chapter_no`, `lesson`, `level K/A/R`, `name`, `sort` | |
| `questions` | `id text`, `school_id`, `teacher_id`, `skill_id`, `type`, `text`, `body jsonb` (opts, ans, key, pairs, x, y, crit, parts, ul, max), `image_path`, `src`, `adapted`, `v` | bank |
| `tests` | `id text`, `school_id`, `teacher_id`, `name`, `type p1/p2/final`, `date`, `dur`, `qs jsonb` (snapshot), `demo` | snapshot semantics kept |
| `test_results` | `(test_id, student_id)` PK, `marks numeric[]`, school/teacher ids | one row per student |
| `improvement_rounds` | `id text`, `test_id`, `crit`, `date`, `round`, `qs jsonb` | |
| `improvement_items` | `(round_id, student_id)` PK, `items int[]`, `results int[] null` | |
| `sheets` | `id uuid`, `key` (test id / round id / `<round>_g`), `student_id`, `storage_path`, `pages text[]` (JPEG renditions), `mime`, `uploaded_at` | private bucket `sheets` |
| `sends` | `(student_id, test_id)` PK, `paper_at`, `imps jsonb`, `impg jsonb`, `plan jsonb`, `sheet jsonb` | from `acks.sent` / `acks.sheet` |
| `perf_tasks` | `id uuid`, `student_id`, `test_id`, `skills text[]`, `title`, `descr`, `deliver`, `due`, `rubric jsonb`, `sent_at`, `ai_eval jsonb`, `teacher_grade`, `teacher_note` | from `acks.sent[t].task` |
| `task_submissions` | `id uuid`, `task_id`, `kind img/pdf/vid`, `storage_path`, `thumbs text[]`, `name`, `size`, `note`, `duration`, `submitted_at` | private bucket `submissions` |
| `acks` | `(student_id, key)` PK, `seen_at` | key = test id, `ew:<test>` |
| `notes` | `id uuid`, `student_id`, `test_id`, `by t/p`, `text`, `at` | teacher ↔ parent thread |
| `behavior_events` | `id text`, `student_id`, `kind pos/neg`, `type`, `note`, `date`, `shared`, `parent_seen_at` | `shared=false` rows never visible to students |
| `class_groups` | `(class_id, idx)`, `stars int`, `members text[]` | |
| `ai_jobs` | `id`, `teacher_id`, `kind`, `status`, `tokens`, `created_at` | quotas/cost, **no prompts or student names stored** |
| `login_attempts` | `ip_hash`, `at`, `ok` | PIN brute-force throttling |

### 3. Auth and RLS
- **Teacher:** Supabase email + password; optional TOTP MFA (`supabase.auth.mfa.*`); teacher pages require `aal2` when the teacher has enrolled a factor.
- **Student/parent PIN login** (`POST /api/student-login`, server-only):
  1. throttle by hashed IP + global counter (e.g. 5 tries / 10 min);
  2. `pin_lookup = HMAC-SHA256(PIN_PEPPER, pin)` → find the student (pepper lives only in Vercel env, so a DB leak alone cannot brute-force PINs offline); verify `pin_hash` (scrypt with per-row salt);
  3. each student has a shadow Supabase Auth user (`<student_id>@students.invalid`, no usable password) created at import; the server issues a session for it with the admin `generateLink(magiclink)` → `verifyOtp(token_hash)` flow and sets the cookie. The student therefore holds a real JWT and **RLS enforces isolation in the database**.
- Helper SQL functions (security definer, `stable`): `auth_teacher_id()`, `auth_student_id()` (student row where `auth_user_id = auth.uid()`), `is_my_student(sid)`.
- Policies (summary):
  - teacher: full CRUD on rows where `teacher_id = auth.uid()` (schools: read own school).
  - student: `select` only on her own rows in `students` (name/class/stars — not PIN columns, exposed through a view), `test_results`, `improvement_items`, `sends`, `perf_tasks`, `task_submissions`, `acks`, `notes`, `behavior_events where shared`; `insert/update` limited to: `acks` (seen), `notes` with `by='p'`, `behavior_events.parent_seen_at`, `task_submissions` for her own task while not graded.
  - question text/answer keys: students never read `tests.qs` or `questions` directly; the portal reads a security-definer RPC `student_portal(test_id)` that returns her tests with **answer keys stripped**, only the improvement questions assigned to her, and only the sheets that were sent.
- Storage: private buckets `sheets`, `submissions`, `qimg`, `logos`; object path `school/<school_id>/student/<student_id>/…`; storage RLS mirrors the table rules; the UI always uses short-lived signed URLs (5 min) generated server-side.
- **Teacher preview:** `/t/preview/[studentId]` renders the same `<StudentPortal>` component from data fetched with the teacher's session (RLS permits), with `readOnly` (ack/notes/upload buttons disabled) and the banner «أنتِ تعاينين صفحة الطالبة ووليّ الأمر» + «طالبة أخرى» + «عودة إلى صفحة المعلمة».
- Privacy: no student data in logs (custom logger redacts; Vercel log drains off), no analytics SDK, `robots: noindex`, CSP, names blurred by default on teacher screens (`priv` class + «إظهار الأسماء»), as in the source.

### 4. Pages / routes
| route | source view |
|---|---|
| `/` | `renderLanding` (PIN form + «دخول المعلمة») with live impact stats |
| `/teacher/login`, `/teacher/mfa` | new (replaces local teacher password) |
| `/t/home` | `vHome` (star board, dashboard, normal-distribution chart, skills map, decisions, early warning, AI accuracy, tour) |
| `/t/live` | `vLive` (timetable, stars, groups, quick behaviour, undo) |
| `/t/students` | `vStudents` (paste / Excel roster, PIN cards print, reset PIN) |
| `/t/skills`, `/t/bank` | `vSkills`, `vBank` (+ AI import / variant / suggest skill) |
| `/t/tests`, `/t/tests/new`, `/t/tests/[id]/entry` | `vTests`, `vBuilder`, `vEntry` (manual grid, Excel, AI photo grading); PDFs |
| `/t/analysis` | `vAnalysis` + `decisionCard` + `gapCard` + CSV |
| `/t/improve` | `vImprove` (+ `impStill`, `impPerStudent`, `impQuestions`, PDFs) |
| `/t/parents` | `vParents` (bulk send) |
| `/t/behavior` | `vBehavior` |
| `/t/school` | `vSchool` (header, logos, font, export JSON, security/MFA) |
| `/t/preview/[sid]` | peek mode |
| report modal | `reportHTML(asTeacher=true)` + `sendPanel`, `taskTeacher`, `sheetBlock`, `gapBlock` |
| `/me` | `vPortal`: stars, early notice, «اختباراتي» (1 period test, 2… improvement rounds), per-question result, graded sheet images, gap by level & skill + three-target cards, remedial/enrichment plan, performance task upload, notes, acks, behaviour notes |
| `/api/student-login`, `/api/ai/*`, `/api/upload-url`, `/api/sheet-url` | server endpoints |

i18n: port `EN`, `EN_PHRASES`, `EN_COUNTS`, `enText` dictionaries into `lib/i18n` (toggle stored in cookie).

### 5. AI features (server-side, `/api/ai/*`)
All prompts copied from the source (Arabic, same JSON shapes), validated with zod, student names never sent (only skill names, levels, marks).
1. `task-suggest` (performance task + rubric) — `taskSuggest`.
2. `task-eval` — upload goes straight to Storage via signed upload URL (avoids Vercel 4.5 MB body limit); server reads it: images → resized JPEG (sharp); **PDF → sent natively as a PDF document block** (first 5 pages); video → `ffmpeg-static` extracts 8 evenly spaced frames + duration; Claude returns per-criterion `got/why`, `fb`, `good`, `next`; teacher approves final mark.
3. `teach` (teaching approach), 4. `plan` (remedial plan), 5. `grade-sheets` (answer-sheet photos → `markOf` → review grid + accuracy log), 6. `read-questions` (photo/PDF → bank drafts), 7. `variant` / `suggest-skill`, 8. `timetable` (photo → timetable grid).
Streaming for long text (`teach`, `plan`). Per-teacher daily quota in `ai_jobs`.

### 6. Scanned sheets (reliable on iPhone Safari / Claude desktop)
- Teacher uploads images or PDF per student (single or bulk by seat number in filename).
- Client converts PDF pages → JPEG with pdf.js at upload; stores original + page JPEGs; HEIC is converted by Safari's picker; server fallback normalises with sharp.
- Display: `<img>` with signed URL (re-signed on error), plus «فتح الورقة في نافذة مستقلة»; never relies on PDF-in-img.

### 7. Offline tolerance (grading screen)
- Grading draft saved to IndexedDB on every tap; a sync queue posts when online; banner «غير متصل — حُفظت التعديلات على هذا الجهاز». Service worker caches the app shell and fonts (`next-pwa`-style, hand-rolled).

### 8. Migration (`scripts/import.ts`)
- `pnpm import ./itqan-data-YYYY-MM-DD.json` using `SUPABASE_SERVICE_ROLE_KEY` locally only; the file is git-ignored and never logged (script prints counts and IDs only).
- Steps: school + teacher (by email arg) → subjects → skills → questions (+ `qimg` data URIs → Storage) → classes (from `cls`) → students (same IDs; PIN = national ID per Decision 2: store `pin_lookup = HMAC(PIN_PEPPER, nid)` + scrypt `pin_hash`, the `nid` itself is discarded) → shadow auth users → tests + results → improvement rounds + items/results → acks (seen / notes / sent / sheet / beh / task) → behaviour → sheets mapping (asset IDs recorded; files uploaded by the teacher are attached by `scripts/import-sheets.ts` from a local git-ignored folder).
- Idempotent: every insert is `upsert … on conflict (id)`; derived IDs are deterministic (uuid v5 from source keys); shadow users looked up before create.
- Ends with: counts per table vs JSON counts, and a spot-check of 3 students (old `studentStats` vs new: base, score, missing skills, levels) — printed as IDs and numbers only.

### 9. Tests and parity
- `lib/calc` unit tests (Vitest) for `pct`, `band`, `qMax`, `studentStats`, `groupStats`, `roundScores`, `buildImprovement` (same seed → same paper), gaps (3 modes), `risk`, `markOf`, `buildPlan`, SD/mean summary.
- **Parity harness**: `tests/parity/legacy.ts` extracts the original functions from `itqan-source.html` at test time, runs them in a Node `vm` against the imported data, and asserts identical outputs for every student/test/round. The source and the data file are read from a git-ignored local path; CI runs the unit tests only with a synthetic fixture (no real data in CI).
- Playwright smoke at iPhone 13 viewport: PIN login, «اختباراتي» numbering, sheet image visible.

### 10. Environment variables (to set in Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), `SUPABASE_SERVICE_ROLE_KEY` (server only), `ANTHROPIC_API_KEY`, `ITQAN_AI_MODEL`, `PIN_PEPPER` (random 32 bytes), `APP_URL`.

### 11. Migration checklist
- [x] Decisions 1–5 answered
- [ ] Repo private; `.gitignore` blocks `itqan-data-*.json`, `itqan-source.html`, `pins-*.csv`, `.env*`
- [x] Scaffold, design tokens, Readex Pro, RTL layout, i18n
- [x] `lib/calc` ported + unit tests + parity harness
- [x] SQL migrations: tables, indexes, helper functions, RLS, storage policies, `student_portal` RPC
- [x] RLS tests (student A cannot read B; student cannot read answer keys; teacher isolation)
- [x] `scripts/import.ts` idempotent + counts + 3-student spot-check
- [x] Teacher auth + TOTP; student PIN login + throttling; preview mode
- [ ] Students / skills / bank / tests / PDFs
- [ ] Grading (manual, Excel, AI) + offline draft
- [ ] Analysis, decision summary, distribution chart, gap (3 targets), CSV
- [ ] Improvement rounds (build, PDFs, results, still-missing, per-student)
- [ ] Parents, sends, notes, acks, behaviour, live class, stars, groups
- [ ] Student portal complete
- [ ] Sheets upload/display (iPhone Safari check)
- [ ] Performance tasks + AI eval (image/PDF/video)
- [ ] Other AI features
- [ ] Deploy to Vercel; custom domain (optional); Arabic hand-off guide
