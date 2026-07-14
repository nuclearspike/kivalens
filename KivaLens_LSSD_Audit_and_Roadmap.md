# KivaLens LSSD Audit and Enhancement Roadmap

Mode: existing-codebase audit / improvement  
Scope: speed, core usability, and Ask KivaLens  
Date: 2026-07-14  
Method: LSSD Master Build Guide v1.0, existing-codebase variant  
Evidence rule: observed = code/build/live response; asserted = user or README; inferred = strong product implication; unknown = decision still needed.

## 1. Header and counts

Product promise: help Kiva lenders turn a very large live loan catalog into a small, understandable, values-aligned set of choices, then move those choices safely to Kiva.

~~~yaml
audit_counts:
  cast:
    actors_named: 15
    actor_planes_swept: 14
    written_rule_outs: 2
  stage_projection:
    stage_inventory_rows: 104
    full_stage_records_in_this_targeted_audit: 7
  chatbot:
    registered_openai_tools_observed: 34
    read_only_tools: 13
    side_effecting_or_ui_mutating_tools: 21
    deterministic_command_registry_entries: 0
    consequence_walks_completed_here: 7
    chatbot_specific_automated_test_files_observed: 4
    behavior_eval_cases: 7
  scenario_storm:
    artifacts: 7
    cells: 98
    storied: 87
    na_with_reason: 11
    empty: 0
  reveals:
    current_or_missing_edges_inventoried: 15
    user_email_push_sms_catalog_rows_observed: 0
    internal_digest_channel_observed: 1
    rss_artifact_channel_observed: 1
  surfaces:
    route_surfaces_observed: 15
    chatbot_surface: 1
    full_surface_origin_matrix_completed: false
  language:
    launch_locales_observed: [en, es, fr, de, it, nl]
    externalized_catalogs_observed: 6
    pseudo_locale_gate_observed: false
  verification:
    unit_tests: "128 passed in 15 files"
    ai_eval_fixtures: "7 valid in dry mode"
    build: passed
    lint: "new files clean; full legacy gate: 155 errors, 6 warnings"
    runtime_cwv_trace: unavailable
~~~

The counts deliberately expose incompleteness. This is a targeted audit, not a claim that G1-G9 are green.

### Applied decisions and implementation update

Implemented on 2026-07-14:

- repaired the post-publish snapshot scheduling null dereference;
- precompressed production assets as Brotli/gzip and split the assistant, charts, and secondary routes from the initial bundle;
- migrated Ask KivaLens from Chat Completions to streamed Responses while retaining the current model default;
- added a seven-case dry/live AI eval harness plus architecture, SSE, storage, and locale tests;
- added browser-local chatbot memory through the fixed `AskKivaLens:` ApplicationStorage namespace, with safe keys, 32-key/4-KiB limits, and no visibility into unrelated local storage;
- localized product chrome and displayed sector labels for English, Español, Français, Deutsch, Italiano, and Nederlands while preserving English Kiva sector values for filters/search and keeping loan description/use text in English.

Explicit product decision: WP-03's universal command proposal/confirmation architecture is declined. Explicitly requested, bounded browser-local actions continue to apply immediately through the existing tool/event path. Existing feature-specific safeguards may remain, but the product will not require confirmation for every chatbot action.

## 2. Intake record

### Asserted

- Apply the LSSD methodology to KivaLens.
- Suggest additions that improve speed and usability.
- Give particular attention to making the AI chatbot more useful.

### Observed

- React 19 + TypeScript + Vite 8 + Zustand client.
- Node production server with Kiva data preparation, static serving, Redis warm cache, RSS, and OpenAI integration.
- KivaLens has no first-party user accounts; lender identity, basket, criteria, options, and saved searches are primarily browser-local.
- Ask KivaLens streams the Responses API, can read live data, emits bounded client-side effects, and can save/retrieve only its own prefixed browser-local memory.
- The current default AI model is gpt-4o-mini.
- The product already has unusually strong deterministic loan filtering and several thoughtful repair states.

### Unknown product decisions

- Which actor is primary for the next release: new lender, occasional lender, or expert/mega-lender?
- Should chat history survive more than two minutes of inactivity, and where? (ApplicationStorage memory is separate from transcript retention.)
- What exact retention period governs raw chat logs and emailed digests?
- Is the desired AI posture “search assistant,” “portfolio coach,” or a broader KivaLens copilot?
- What latency, cost-per-successful-task, and task-success targets define a better chatbot?

## 3. Anchor outcomes and confirmation plans

| Anchor | Durable truth | Outcome confirmation |
|---|---|---|
| A1 Fast useful first result | A visitor can reach comprehensible, filterable loan results without waiting through unrelated work. | p50/p95 time-to-first-usable-results; loading abandonment; first filter completion. |
| A2 Grounded decision help | The assistant answers from the current dataset, current page, current criteria, and permitted portfolio facts, with visible evidence. | grounded-count accuracy; selected-loan accuracy; “why this?” expansion use; correction rate. |
| A3 Bounded immediate actions | Explicitly requested browser-local chatbot actions validate arguments, remain within current product authority, apply immediately, and reveal the resulting state without a universal confirmation ceremony. | tool-selection precision; invalid-action blocks; emitted-event/application success; false-success and race tests. |
| A4 Product learns honestly | Chat failures and user corrections become redacted eval cases and story analytics, not anecdotes. | eval-suite pass rate; tagged failure trend; helpful/not-helpful feedback. |
| A5 Returning continuity | A returning lender can understand what is saved, what changed, and what to do next without surrendering privacy. | resume rate; stale-search repairs; repeat task completion; deletion success. |
| A6 Operable production | The operator can reconstruct a chat/command/data-refresh story and control cost or abuse without secrets in URLs. | reconstruction under one minute; per-client rate events; budget variance; refresh/snapshot success. |
| A7 Localized product chrome | Chrome and displayed sectors render in six selected locales while descriptions/use and canonical sector values remain English. | locale switch tests; sector value/label invariants; fallback events; scoped hardcoded-string audit. |

## 4. Targeted StoryTime compendium

### 4.1 Cast sweep

| Plane | Actor or rule-out | Goals / fears | Evidence |
|---|---|---|---|
| Visitor / anonymous | visitor | Find relevant loans quickly; fear a slow or expert-only tool. | observed, Search and index shell |
| Primary end user | lender | Find, understand, shortlist, and transfer loans; fear hidden risk and lost work. | observed |
| Counterparty | represented borrower / data subject | Be represented accurately and respectfully; fear misleading inference or stale public data. | inferred from public borrower data |
| Sub-actors / staff | ruled out | No KivaLens accounts, organizations, or delegated roles are implemented. Revisit if shared strategies arrive. | observed |
| Operator / admin | operator | Keep data, AI, budget, and production healthy; fear silent refresh or cost failures. | observed |
| Support | support operator | Reconstruct what the user saw and what the AI did. | inferred; partial log tools observed |
| Finance | ruled out | KivaLens does not process checkout, repayments, or lender funds. Kiva owns those stories. | observed |
| Trust / compliance | privacy steward | Honor deletion/retention and protect chat/lender identifiers. | observed in Privacy page |
| System / scheduler | scheduler | Refresh data, resync clients, clean caches, send internal digest. | observed |
| AI agent | Ask KivaLens | Explain, diagnose, remember namespaced local preferences, and apply bounded requested browser actions without fabricating data or action. | observed |
| External service | Kiva platform | Supply public data and own checkout. | observed |
| External service | OpenAI API | Produce streamed responses and tool calls. | observed |
| External service | Redis / hosting | Persist snapshots, spend, and interaction logs. | observed |
| External service | Google Docs / A+ research | Supply supplemental partner research. | observed |
| Message recipient without account | RSS recipient | Receive a durable search feed without a KivaLens account. | observed |
| Future / returning self | returning lender | Resume criteria, basket, saved searches, and preferences; detect stale truths. | observed/inferred |
| Auditor / data subject | lender or represented borrower | Understand and request handling of logged or public-linked data. | asserted by privacy surface |

Cast gate: PASS for the targeted sweep. All 14 planes are named or ruled out; external-service actors are intentionally split.

### 4.2 Lifecycle ladders

The inventory below projects current and missing stages. Counts are inventory rows, not full stage records.

| Actor | Discovery / entry | Setup / activation | Seeking / committing | Waiting / holding | Lived event / aftermath | Steady state | Exit / return | Count |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| visitor | 2 | 1 | 1 | 1 | ruled out: checkout is off-site | 1 | 1 | 7 |
| lender | 1 | 2 | 4 | 2 | 2 | 3 | 2 | 16 |
| returning lender | ruled out: same human with history | 1 | 2 | 1 | 1 | 3 | 2 | 10 |
| represented borrower / data subject | ruled out: no direct entry | ruled out: no account | 1 | 1 | 2 | 1 | 2 | 7 |
| operator | queue empty | item claimed | investigating | acting | resolved / escalated | reporting | handoff | 6 |
| support operator | queue empty | item claimed | reconstructing | waiting on evidence | repair / explain | pattern review | close / reopen | 6 |
| privacy steward | request received | identity/context gathered | scope records | hold conflicts | delete / retain decision | report | appeal / close | 6 |
| scheduler | cold start | hydrate | refresh | publish | snapshot | digest | cleanup / retry | 8 |
| Ask KivaLens | hidden / idle | context received | answering / diagnosing | Responses tool loop / client event | response / resulting state | continued conversation | abort / reset / disabled | 9 |
| Kiva platform | API requested | data returned | checkout handoff | user completes off-site | status changes | public history | timeout/failure | 4 |
| OpenAI API | request accepted | generation | tool call | continuation | final output | usage record | refusal/error | 4 |
| Redis / hosting | connect | hydrate | store | retry/fallback | persisted | expiry | outage/recovery | 4 |
| Google Docs / A+ | fetch | normalize | merge | stale wait | reveal research | refresh | failure fallback | 3 |
| email delivery | digest requested | send | accept | bounce wait | delivered | archive | failure | 4 |
| RSS recipient | discover URL | subscribe | receive items | wait for matches | open handoff | continue | unsubscribe / stale feed | 4 |

Projected stage inventory: 104.

### 4.3 Full stage records

#### ST-01 lender.first_load_waiting

- Actor: visitor/lender
- Band: waiting
- Entry: SPA shell loaded; loan dataset not yet usable.
- Exit: partners and all four current loan pages processed, or Kiva fallback succeeds/fails.
- Visible truths: progress title/label; segmented progress; secondary background messages.
- Hidden truths that matter: live batch age, page-level completion, fallback cause, snapshot availability.
- Available: wait; read “Did you know.”
- Blocked: search and compare, with no explicit becomes-available timestamp.
- Deferred: use AI; widget availability is checked separately.
- Askable: “How long will this take?”, “Is the data fresh?”, “Can I start with partial results?”
- Silence: exact data freshness and cold-start reason are not shown.
- Bail: close tab; no abandonment analytics.
- Finding: progressive first-page results and explicit freshness would reduce anxiety.

#### ST-02 lender.zero_results_repair

- Actor: lender
- Band: seeking
- Entry: filtered loan count becomes zero after the app previously had results.
- Exit: remove one filter, reset, or ask AI.
- Visible truths: every active constraint; counterfactual result count after removing it.
- Available: remove a constraint; reset; ask AI.
- Blocked: no deterministic “relax the smallest-impact constraint” one-click action.
- Hidden: which constraint combination, rather than single constraint, is the true bottleneck.
- Askable: “Why zero?”, “What is the smallest relaxation?”, “Keep my values but widen geography.”
- Silence: no explicit statement of data freshness.
- Strong current behavior: this is a real repair surface, not a dead-end error.

#### ST-03 lender.chatting_in_ask_mode

- Actor: lender
- Band: seeking / steady state
- Entry: chat panel opens and a user message is submitted.
- Exit: grounded answer, immediate bounded action, error, stop, minimize, or reset.
- Visible truths: streamed response, inline charts, loading indicator, disclosure that chats are logged.
- Available: ask, stop, reset, minimize.
- Blocked: no explicit list of what the assistant cannot safely do.
- Hidden: tool calls, dataset version, confidence, protected exclusions, prompt/model version.
- Decision: a universal command preview/confirmation artifact is intentionally not part of the product.
- Askable: stage-specific suggestions are not surfaced as chips.
- Silence: no per-answer provenance or freshness badge.

#### ST-04 ai.immediate_action

- Actor: Ask KivaLens and lender
- Band: seeking / acting
- Entry: an explicit user request selects a bounded side-effecting browser-local tool.
- Exit: arguments validate and the client event applies, or the request is blocked/failed.
- Visible truths: resulting criteria/basket/search/navigation/memory state and any deterministic count.
- Available: ask “why,” correct the request, reverse through existing controls, or continue.
- Blocked: invalid vocabulary, out-of-scope authority, unsafe ApplicationStorage content, or stale/unavailable domain truth.
- Hidden: internal model reasoning, unrelated localStorage, and protected data.
- Intentional silence: no exposure of raw prompt or private operator notes.
- Current delta: actions are immediate by design; client acknowledgement/result reconstruction remains incomplete.

#### ST-05 ai.partial_failure_or_abort

- Actor: lender, AI, support
- Band: exception
- Entry: user stops, SSE disconnects, OpenAI fails, or a tool side effect emits before final response.
- Exit: retry read work, summarize any client events already emitted, or repair through existing controls.
- Visible truths: current UI marks partial assistant text “interrupted”; action state is not consistently summarized.
- Available target: retry, copy error reference, inspect current resulting state, or reverse with the normal UI.
- Blocked: blind replay of a non-idempotent action until current state is known.
- Support reveal target: prompt/schema version, tool call and call_id, emitted client/storage event, failure point.
- Finding: current logs are written only after normal completion; abort stories can disappear.

#### ST-06 support.reconstructing_ai_story

- Actor: support operator
- Queue band: investigating
- Entry: user reports wrong answer, surprise mutation, cost, or privacy concern.
- Visible current truths: recent raw logs behind an admin key; truncated tool args/results; monthly estimated spend.
- Missing truths: user-visible rendered sequence, SSE acknowledgement, command receipt, abort, prompt version, cache usage, latency phases, feedback, deletion state.
- Available target: filter by opaque session ID, inspect redacted timeline, replay read-only eval, mark failure tag, delete or retain under policy.
- Security finding: the admin key is accepted as a URL query parameter; digest sending is triggered by GET.

#### ST-07 returning_lender.resume

- Actor: returning lender
- Band: exit / return
- Entry: browser returns after more than two minutes or after a data batch/taxonomy change.
- Visible truths: criteria, basket, saved searches, options, lender ID persist; chat transcript does not.
- Available: continue search, load saved search, inspect basket.
- Blocked target: applying a stale saved strategy until changed fields are re-revealed.
- Askable: “What changed since last time?”, “Resume my last goal,” “Are these still the best matches?”
- Finding: the product persists raw controls but not the actor’s goal or decision rationale.

### 4.4 Consequence walks

#### CW-01 ask_grounded_question

- Mode: Ask, read-only.
- Eligibility: actor may see the referenced public/current/local truths.
- Success: answer includes data source, current batch freshness, confidence caveat where needed, and legal next actions.
- Other actors: operator gets redacted analytics; no state mutation.
- Failure: unavailable data becomes a question or retry state, never a fabricated answer.
- Race: selected loan or criteria changes mid-answer; response must carry a context fingerprint and disclose staleness.
- Tests: selected-loan pronouns; exact count; protected exclusion; stale context; OpenAI refusal.

#### CW-02 set_search_criteria

- Current: model calls set_criteria; server emits apply_criteria; client mutates immediately; server tells the model success without client acknowledgement.
- Target risk: low and reversible.
- Target preview: before/after chips, added/removed constraints, deterministic match count, freshness.
- Ceremony: explicit action language may authorize immediate apply with a visible undo receipt; ambiguous language produces a preview card.
- Success reveals: result count, criteria diff, undo affordance, analytics event.
- Failure: invalid values explained; zero results offer ranked repair.
- Race: manual criteria edit after proposal invalidates proposal fingerprint.
- Tests: merge/remove semantics; multi-value; zero results; same intent from chat/button; disconnect before acknowledgement.

#### CW-03 bulk_add_to_basket

- Current: prompt asks the model to confirm rough total; enforcement is not deterministic.
- Target risk: medium because it creates many local lending intents.
- Preview: item count, per-loan amount, total, duplicates skipped, Kiva checkout remains separate.
- Ceremony: explicit confirmation card required.
- Success reveals: exact items applied and basket total; undo removes only this command’s additions.
- Failure: stale/funded loan, cap conflict, partial client apply, disconnect.
- Race: basket manually changes after preview; re-preview.
- Tests: cap, Kiva minimum, duplicates, partial apply, stale state, confirm/cancel.

#### CW-04 clear_basket

- Current: tool description says “Confirm with the user first”; handler always emits clear.
- Target risk: destructive local action.
- Preview: count and total that will be removed.
- Ceremony: explicit confirm; deterministic handler; one-step undo for the previous basket snapshot.
- Failure/race: basket changed after preview; refuse and refresh preview.
- Tests: no confirm, double confirm/idempotency, concurrent tab, undo.

#### CW-05 delete_saved_search

- Current: description asks for confirmation; no registry enforces it.
- Target: preview exact search and whether alerts/RSS expectations depend on it; confirm; tombstone/undo window.
- Reveals: deletion receipt and alternatives.
- Race: rename/delete in another tab.
- Tests: name ambiguity, missing search, confirm, undo, alert cleanup.

#### CW-06 set_lender_id

- Current strengths: validates format and verifies against Kiva before emitting.
- Target risk: privacy-affecting identity link.
- Preview: public data categories unlocked and chat-context consequence.
- Ceremony: explicit consent; clear remove path; never log raw ID where an opaque hash suffices.
- Reveals: verification result, portfolio-load state, privacy link.
- Failure: typo, Kiva timeout, ID changed mid-chat.
- Tests: public-profile failure, redaction, removal, recipient-visible logging state.

#### CW-07 stop_stream_after_side_effect

- Current: client aborts and saves partial text; any earlier SSE mutation may already be applied.
- Target: every command carries proposal and receipt IDs; stop cancels pending proposals but does not mislabel completed receipts.
- Reveals: “Stopped. One action had already completed: … Undo.”
- Support: timeline records abort and last acknowledged event.
- Tests: stop before proposal, during proposal, after execute/before text, after receipt.

### 4.5 Scenario storm

Legend: S = storyline applies; N/A = structurally inapplicable with reason.

| Artifact | S1 abandon | S2 reject | S3 expiry | S4 cancel before | S5 cancel after | S6 change | S7 collision | S8 external/partial | S9 reversal/dispute | S10 no response | S11 empty | S12 return stale | S13 operator | S14 deletion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chat_session | S partial transcript | S refusal/budget | S upstream timeout missing | S stop stream | N/A no binding commitment | S reset/history | S multi-tab turns | S SSE/OpenAI partial | N/A no money | S stalled stream | S greeting | S 2-minute TTL loss | S log review | S raw-log request |
| immediate_action event | S abandoned turn | S validation block | S underlying data expiry | S stop before event | S repair via normal controls | S corrected follow-up | S manual-vs-chat race | S event/apply split | N/A no local payment | S stalled model | S no action needed | S stale local state | S support replay read-only | S event/log retention |
| search_criteria | S partial intent | S invalid vocab clamp | S taxonomy staleness | S undo/reset | S reset committed filters | S merge/remove | S two tabs | S lost SSE apply | N/A no money | S model never repairs | S zero results | S saved criteria stale | N/A no operator mutation | S clear browser data |
| basket | S checkout abandoned | S funded loan pruned | S fundraising expiry | S remove | S transfer handoff/correction | S amount edit | S manual/chat collision | S lost SSE/Kiva handoff | N/A payment owned by Kiva | S checkout never completed | S empty basket | S stale loan prune | N/A no operator basket control | S clear storage |
| saved_search | S unnamed/unfinished save | S invalid/duplicate name | S stale fields | S delete | N/A no external commitment | S replace/load | S multi-tab overwrite | S storage quota | N/A no money | S alert expectation unmet | S empty list | S old taxonomy | N/A no operator edit | S clear/export/delete |
| ai_interaction_log | S abort may be absent | S redact/protected data | S retention/rotation | S deletion request | S audit commitment cannot silently vanish | S unversioned schema | S digest/clear race | S Redis fallback | S cost correction | S digest failure | S no evidence | S email archive remains | S admin access | S data-subject deletion |
| dataset_snapshot | S refresh aborted | S bad records skipped | S TTL/batch retention | S shutdown during build | S atomic publish | S Kiva schema/data drift | S live-vs-cache race | S Kiva/Redis failure | N/A no money | S Kiva hangs | S cold cache | S seven-day stale limit | S restart/intervention | S version eviction |

Storm result: 7 × 14 = 98 cells; 87 storied; 11 N/A with reasons; zero empty.

Storm yields folded into recommendations:

- immediate action and ApplicationStorage events need deterministic validation and bounded scopes;
- current-state checks prevent stale or ineligible actions;
- abort and emitted-client-event timing become support-visible evidence;
- saved strategies require staleness semantics;
- interaction logs require explicit retention, deletion, and prompt/schema versions;
- refresh publication and snapshot persistence require independent success events.

### 4.6 Reveal edges and communication catalog

| Edge | Truth | Recipient / surface | Current state |
|---|---|---|---|
| RE-01 | SPA/app still loading | visitor / initial shell | observed |
| RE-02 | dataset page progress | lender / loading panel | observed |
| RE-03 | data refresh happening | lender / Search alert | observed |
| RE-04 | basket loan no longer fundable | lender / basket notice | observed |
| RE-05 | current filter count | lender / count bar + toast | observed |
| RE-06 | zero results and repairs | lender / NoResultsHelp | observed, strong |
| RE-07 | AI token stream | lender / chat bubble | observed |
| RE-08 | AI/tool side effect | lender / resulting UI change | observed; explicit applied-state summary remains partial |
| RE-09 | AI unavailable/budget/error | lender / chat error | observed |
| RE-10 | chat logging disclosure | lender / chat footer + Privacy page | observed |
| RE-11 | chatbot memory stored/retrieved | lender / later Ask KivaLens turn | observed within prefixed namespace |
| RE-12 | immediate action reconstructed | lender/support / state + timeline | support timeline missing |
| RE-13 | data freshness/batch | lender/AI answer | missing |
| RE-14 | AI interaction + cost | operator / raw log and digest | partial |
| RE-15 | deletion completed/retained reason | data subject / durable response | missing |

Current non-UI communication: one RSS artifact for subscribers and one internal email digest. No user email/push/SMS catalog was observed. That is acceptable only where silence is explicitly chosen; future alerts must begin as reveal rows, not ad hoc notifications.

### 4.7 Artifact stories

| Artifact | Authority / visibility | Lifecycle and current gap |
|---|---|---|
| search_criteria | lender/browser; sent to AI when used | persisted locally; merged/replaced/cleared; no version or stale-taxonomy story |
| basket | lender/browser; summary sent to AI | add/edit/remove/transfer/prune; no cross-tab version |
| saved_search | lender/browser | save/load/delete/notify; no export/version/stale-field story |
| chat_session | lender/browser + server/OpenAI | 2-minute restore window; streamed/reset; raw history sent repeatedly; Responses uses store:false |
| ai_application_storage | lender/browser; sanitized snapshot sent to AI | fixed AskKivaLens: namespace; 32 safe keys; 4 KiB/value; unrelated storage excluded |
| ai_interaction_log | operator/Redis/email | raw prompt/response/tool metadata; capped/rotated; aborted runs can be absent; deletion and email retention ambiguous |
| dataset_batch_snapshot | server/Redis | refresh/publish/cache/expire; post-publish snapshot scheduling null dereference repaired |

### 4.8 Detail stories needing explicit authority

| Detail | Source / authority | Purpose confidence | Gap |
|---|---|---|---|
| actor locale | declared > browser > English default | chrome and sector display | stored six-locale catalog; long-form content intentionally English |
| lender ID | lender declaration verified by Kiva | portfolio lookup | raw value enters prompt/log |
| current criteria | browser store | filtering and AI context | no version/fingerprint |
| selected loan | route/store | “this loan” grounding | can change during answer |
| dataset freshness | server batch/newestTime | answer trust | not revealed in UI/chat |
| partner risk rating | Kiva/A+ | relative risk explanation | terminology handled in prompt, but provenance not surfaced |
| inferred age/gender proxies | parsed/derived | search assistance only | caveat exists in prompt; should become visible evidence |
| AI cost estimate | hardcoded local price table | monthly kill switch | unknown models fall back to gpt-4o-mini pricing |
| raw chat retention | operator policy | support/improvement | “as long as useful” is not a deterministic lifetime |
| command confirmation | user click on exact preview | mutation authority | currently inferred from conversation text |

### 4.9 Question capability map

The assistant should guarantee these stage-aware families:

- What am I looking at? Explain the current page, result count, selected loan, basket, or saved search.
- Why did this happen? Explain zero/few results from actual active criteria only.
- What changed? Show criteria, basket, dataset, or saved-strategy deltas.
- What is risky or uncertain? Explain partner rating, default/delinquency, currency loss, data freshness, and parsed-age limitations with provenance.
- What should I do next? Offer legal next actions from the current stage, not generic advice.
- Compare choices. Compare 2-4 loans or partners on user-declared priorities without presenting philanthropic lending as investment return.
- Help me diversify. Compare portfolio distribution to declared goals and distinguish preferences from commitments.
- Was that applied? Read the current UI/domain state and emitted event evidence, not model memory.
- What data do you use? Explain local storage, Kiva public data, OpenAI, logs, retention, and deletion.
- What can’t you do? State that KivaLens cannot complete checkout, transfer funds, promise repayment, or infer protected facts.
- Can I resume? Explain saved local state, chat lifetime, stale truths, and changed data.

Each answer family needs: allowed actor, data sources, protected exclusions, provenance shape, eligible bounded tools, and an honest unknown fallback.

## 5. Current subsystem snapshot and findings

### Strengths worth preserving

- Shared deterministic loan filter between UI and AI.
- Server-only API key and streamed responses.
- Criteria validation/clamping and lender-ID verification.
- Selected-loan and current-page context.
- Zero-result repair UI with counterfactual counts.
- Route-level lazy loading for the largest operational pages.
- Immutable caching for hashed assets.
- Gzipped, ten-minute-cached loan/partner/options API data.
- Redis fallback behavior and a global AI kill switch/budget.
- Explicit privacy disclosure and AI opt-out.
- Defensive chart rendering and image/base64 suppression.
- Virtualized loan list and pruning of non-fundraising client data.

### Findings

| ID | Severity | Finding | Evidence | Laws / audits |
|---|---:|---|---|---|
| F-01 | resolved | Snapshot scheduling now reads state.allLoans.length after releasing the temporary processed collection. | server/klCore.mjs | L20, L38; A13 |
| F-02 | resolved | Build emits Brotli/gzip sidecars and production negotiates them with Vary while retaining immutable caching and original MIME types. | scripts/compress-dist.mjs; server/prod.mjs; verified headers | A2 dependency/perf |
| F-03 | accepted decision | Side-effecting browser-local AI tools execute immediately by explicit product choice; no universal registry/preview/confirmation layer is planned. | server/aiChat.mjs + product decision | L21-L23; A4, A16 |
| F-04 | 1 | The server tells the model a client-side mutation succeeded before the client acknowledges it; abort/SSE failure can split truth. | SSE events + client handlers | L16, L20-L23; S7/S8 |
| F-05 | 1 | AI abuse/cost controls lack per-client rate/concurrency limits and atomic budget reservation; unknown models use a low fallback price. | aiChat request entry; aiUsage pricing | L23, L39; A16 |
| F-06 | partially resolved | Seven behavior fixtures and architecture/SSE/storage tests now cover the Responses and ApplicationStorage boundaries; production-derived depth remains future work. | evals/ask-kivalens.json; new tests; 128 tests pass | L42; A16 |
| F-07 | 1 | Admin secrets are accepted in query strings and a side-effecting digest send uses GET. | server/aiChat.mjs:1355-1400 | L21, L23, L35 |
| F-08 | scoped resolution | Six locale catalogs now cover core chrome and displayed sectors; descriptions/use intentionally remain English, while pseudo-locale and complete long-form coverage remain deferred. | src/i18n; localized surfaces | L31-L34; G8/A8 |
| F-09 | resolved | Main is now 333 KB minified / 106 KB gzip; chatbot, charting, and secondary routes are lazy chunks. | npm run build; App.tsx | L2/L3; speed |
| F-10 | partially resolved | Ask KivaLens now uses streamed Responses with store:false, prompt_cache_key, and safety_identifier while intentionally retaining the current model; page/intent tool subset work remains. | aiChat.mjs + official OpenAI docs | A16 |
| F-11 | 2 | Tool schemas are non-strict; CRITERIA_PARAM permits arbitrary properties. Runtime clamping helps but cannot replace strict intent contracts. | TOOL_DEFS/CRITERIA_PARAM | L21-L23 |
| F-12 | 2 | Four keyword/description pages add ~721 KB compressed / 3.69 MB expanded and are fetched sequentially after initial results, then refilter all loans. | live /api/start, curl, kiva.ts:546-567 | speed |
| F-13 | 2 | The initial dataset expands to ~5.36 MB JSON and is parsed/processed on the main thread before first results. | /api/start lengths, kiva.ts | speed/usability |
| F-14 | 2 | Chat lacks provenance/freshness cards, suggestion chips, action receipts, feedback controls, and accessible live announcements. | AskKivaLens.tsx | L15, L20, L36, L41 |
| F-15 | 2 | Viewport disables zoom; chart answers have no accessible data alternative; chat dialog/status semantics are incomplete. | index.html:58; AskKivaLens | A15/accessibility |
| F-16 | 2 | Returning state preserves controls but not the lender’s goal, rationale, or “what changed” story; chat is discarded after two minutes. | local storage/chat TTL | L7-L13 |
| F-17 | 2 | Interaction logs are content-rich but not a reconstruction timeline: no prompt/schema version, latency phases, cache usage, emitted client/storage-event evidence, feedback, or abort record. | aiUsage.mjs | L35-L36; A12/A14 |
| F-18 | 2 | Lint is not a usable quality gate: 155 errors and 6 warnings remain from legacy typing/effect patterns. | npm run lint | L43/DoD |
| F-19 | 3 | First-run and expert workflows share the same dense nine-link nav and three-column search workspace; progressive disclosure is limited. | KLNav/Search | L24-L25/L41 |
| F-20 | 3 | The external Google Font stylesheet is render-blocking and introduces two origins despite a viable system-font fallback. | index.html | speed |

Severity meaning: 1 = trust/reliability or high-leverage performance prerequisite; 2 = material next-slice improvement; 3 = valuable optimization or product expansion.

## 6. AI tool and action boundary

Observed tools: 34.

Read-only tools (13) are the original 12 analysis/list/detail tools plus `retrieve_application_storage`.

Side-effecting or UI-mutating tools (21) are the original 20 browser action tools plus `save_application_storage`.

Selected product behavior:

- no universal command registry, proposal artifact, preview card, or confirmation ceremony;
- explicit natural-language requests may apply bounded browser-local changes immediately;
- tool arguments are still clamped and validated, and unsupported/out-of-scope actions remain blocked;
- ApplicationStorage writes emit a dedicated SSE event and are restricted to the fixed `AskKivaLens:` prefix;
- the agent sees only a sanitized snapshot of its own namespace and may not store secrets, payment data, lender IDs, or borrower descriptions;
- Kiva remains authority for checkout, funding, repayment, and all external financial state.

The historical consequence walks below remain useful for failure/race analysis, but their proposal/confirmation targets are superseded by this decision.

## 7. Recommended work packages

### WP-00 — Repair and baseline

Priority: P0  
Outcome: refreshes finish, snapshots persist, and quality/performance numbers are repeatable.

- Replace the post-null processed.length access with a retained count or state.allLoans.length.
- Add a refresh test with fake Kiva/Redis adapters proving publish and delayed snapshot scheduling.
- Make lint incremental: either fix current violations or ratchet a checked baseline so new violations fail.
- Add a repeatable bundle/API measurement script and configure the missing Chrome DevTools performance integration.
- Targets: every refresh emits started/published/snapshot_saved or explicit failed stage; zero unhandled post-publish errors.

### WP-01 — Compress and split the delivery path

Priority: P0 — implemented  
Outcome: less transferred and parsed before first useful result.

- Build emits Brotli and gzip sidecars; production negotiates br/gzip and sets Vary: Accept-Encoding.
- Immutable caching is preserved for hashed assets.
- Ask KivaLens, charting, and all secondary routes load as separate chunks.
- Current main: 333.23 KB minified / 105.77 KB gzip / 90.66 KB Brotli; CSS: 49.00 KB / 10.55 KB gzip.
- Initial compressed JS remains under the 180 KB target; no initial chunk exceeds 500 KB uncompressed.

### WP-02 — Progressive data readiness

Priority: P1  
Outcome: first useful results arrive before the entire enrichment corpus.

- Render/filter after partners + first loan page, then merge remaining pages.
- Move JSON normalization and large filtering to a Web Worker or chunked scheduler.
- Fetch keyword/description packets in parallel, on idle, or only when full-text features need them.
- Cache parsed batch data in IndexedDB keyed by batch with explicit staleness.
- Show freshness, partial completeness, and what capability is still loading.
- Measure first-page usable, full-data ready, main-thread long tasks, and memory.

### WP-03 — Immediate-action chatbot

Decision: universal proposal/confirmation architecture declined  
Outcome: useful actions stay low-friction while remaining bounded and observable.

- Apply explicit criteria, basket, saved-search, navigation, chart, identity, and memory requests immediately through the current tool/event path.
- Keep deterministic argument validation and domain authority boundaries.
- Show concise applied/blocked/failed status and the resulting visible state; do not add a confirmation step to every action.
- Preserve only feature-specific safeguards already justified by the underlying action.
- Add abort/race tests so a dropped stream cannot create a false-success narrative.

### WP-04 — AI eval and safety harness

Priority: P0 — initial harness implemented  
Outcome: model/prompt changes become measurable.

Seven dry/live fixtures now cover canonical English sector arguments from non-English prompts, exclusion semantics, ApplicationStorage save/retrieve, navigation, country-code resolution, and the no-investment-return boundary. Architecture tests cover flattened Responses tools, store:false, storage clamping, and SSE parsing.

Expand with these story cases:

- selected-loan pronouns and current-page grounding;
- exact counts after filter apply;
- exclude vs include and multi-value criteria;
- zero-result diagnosis and smallest repair;
- partner risk direction and portfolio-yield misconception;
- no lender-ID prompt when already set;
- ambiguous reset-chat vs reset-criteria;
- immediate action applied/blocked/failed state and repair;
- bulk-add total and stale basket;
- stream abort before/after side effect;
- prompt injection and out-of-domain requests;
- log redaction and data-deletion request;
- Kiva/OpenAI/Redis timeout;
- non-English/pseudo-locale;
- screen reader response announcements.

Metrics: task success, grounded facts, exact count, tool-selection precision, invalid-action blocks, immediate-action success/failure, tool rounds, input/output/cached tokens, TTFT, total latency, cost per successful task, and user feedback.

Use redacted production failures only with documented retention and review policy.

### WP-05 — Responses API and model/prompt modernization

Priority: P1 — Responses migration implemented; optimization remains  
Outcome: better tool reliability and lower latency/cost at measured quality.

- Stream Responses output events and pair function_call_output items by call_id.
- Use store:false, prompt_cache_key, and a privacy-preserving safety_identifier.
- Keep the current model default until live eval evidence supports a change.
- Function definitions are flattened for Responses; strict mode remains deferred because dynamic criteria schemas first need representative eval coverage.
- Next: shorten the repeated prompt, avoid injecting full taxonomy lists, and expose page/intent tool subsets instead of all 34.
- Next: record prompt/tool schema versions, cache tokens, finish reason, latency phases, and cost per successful task.

Official references:

- [Latest model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Migrate to Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Strict function calling](https://developers.openai.com/api/docs/guides/function-calling#strict-mode)
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Safety identifiers](https://developers.openai.com/api/docs/guides/safety-best-practices#implement-safety-identifiers)

### WP-06 — Evidence-first answers

Priority: P1  
Outcome: useful answers users can trust and act on.

Add compact response cards:

- “Using live batch 50, updated …”
- criteria diff and exact result count;
- loan/partner facts used, with source label;
- uncertainty/caveat chips for parsed age, inferred tags, partner research, and stale data;
- “why this suggestion” tied to declared lender priorities;
- legal next actions from the current stage;
- applied/blocked action status tied to the resulting visible state;
- accessible text table behind every chart.

Make “What changed?”, “Why blocked?”, “What next?”, and “Was that applied?” deterministic question families.

### WP-07 — Stage-aware chat UX

Priority: P1  
Outcome: the assistant teaches the current screen instead of waiting for perfect prompts.

- Suggestion chips derived from page/stage:
  - first run: “Find loans by what I care about”
  - zero results: “Relax the smallest constraint”
  - loan detail: “Explain risk and repayment”
  - basket: “Review concentration and total”
  - saved search: “Explain or update this search”
- Add a visible mode/status line: Asking, Applying, Applied, Blocked, Failed.
- Add thumbs up/down plus failure tags and optional comment.
- Add “copy answer,” “report issue,” and “show sources.”
- Announce streaming text, tool status, errors, and receipts through accessible live regions.
- Preserve input drafts and provide a deliberate “new chat” vs “close” distinction.

### WP-08 — Goal and strategy artifact

Priority: P2  
Outcome: chat helps with decisions, not only controls.

Create a browser-local, exportable lending_goal artifact:

- impact themes and exclusions;
- geography/sector preferences;
- diversification targets;
- risk comfort and repayment-speed preference;
- one-time or recurring budget;
- evidence/source and confidence for every preference;
- review date and “forget this” control.

The AI may use soft preferences to rank/explain help; only explicit commands change criteria or basket. Show the gap between stated goal and current portfolio, and never frame Kiva as an investment return.

### WP-09 — Comparison workspace

Priority: P2  
Outcome: users understand tradeoffs before adding to basket.

- Pin 2-4 loans or field partners.
- Compare impact, amount still needed, repayment timing, partner risk/delinquency/default, currency-loss liability, and data confidence.
- Let AI summarize tradeoffs against the declared goal.
- Keep the underlying table visible and accessible; chat adds explanation, not replacement.
- Save comparison as a local artifact with stale-data recheck.

### WP-10 — Returning-user continuity with privacy

Priority: P2  
Outcome: resume the human story, not a raw transcript by accident.

- Persist an optional compact conversation summary locally, not full raw history by default.
- Offer session durations: this tab, 24 hours, until manually cleared.
- Add “what changed since last visit” for dataset, saved criteria, basket, and strategy.
- Show/export/delete the opaque chat identifier so deletion requests are actionable.
- Define raw log and emailed digest retention in days, with deletion propagation.
- Treat provider-side conversation storage as explicit opt-in.

### WP-11 — Abuse, cost, and operator reconstruction

Priority: P0/P1  
Outcome: production remains available and explainable.

- Per-IP and privacy-preserving client/session token buckets; per-client concurrency cap.
- Atomic budget reservation before request; reconcile actual usage after.
- Fail closed for unknown model pricing instead of silently using gpt-4o-mini cost.
- Replace query-string admin secrets with Authorization headers and POST for digest sends.
- Separate audit from analytics; redact lender IDs and user content by default.
- Build a timeline: request, prompt/schema versions, context fingerprint, tool call, emitted client/storage event, resulting reveal, abort/error, and feedback.
- Log TTFT, total latency, round count, cache tokens, retry and blocked reasons.
- Provide a redacted export/deletion workflow.

### WP-12 — Language and accessibility foundation

Priority: P1 — full first-party static localization implemented  
Outcome: every first-party page and interaction supports six locales without corrupting Kiva's English search vocabulary.

- Semantic catalogs and persisted locale selection support English, Español, Français, Deutsch, Italiano, and Nederlands; the globe dropdown renders each option in its native language.
- Page copy, long-form About/Privacy copy, controls, configuration-defined options, hover help, dialogs, loading/error states, accessibility labels, AI startup copy, and default saved-search display names are cataloged.
- Ask KivaLens receives the selected locale and answers in that language while retaining canonical English criteria, saved-search keys, sector values, and tool arguments.
- Displayed sector labels localize; Kiva-provided loan descriptions, use/activity text, and partner-research narratives intentionally remain in their source language.
- Coverage tests reject missing locale entries and raw first-party JSX, labels/tooltips/accessibility attributes, dialogs, or user-facing status/error setters.
- Generated catalogs are checked in and split per secondary locale; English startup does not download them, and selecting a language loads only its catalog.
- Remaining: human review of generated translations, pseudo-locale CI, locale-aware currency/number formatting, logical CSS, zoom/mobile/a11y verification, and accessible chart tables.

### WP-13 — Progressive novice/expert workspace

Priority: P2  
Outcome: new lenders orient quickly without slowing power users.

- Replace audience copy “Kiva Expert” with outcome-led entry copy unless research confirms the expert-only audience.
- Add “Guided” and “Advanced” search modes backed by the same criteria truth.
- Keep high-frequency nav visible; group Wall, Teams, Stats, Options, and About under secondary navigation on small screens.
- Preserve density, keyboard shortcuts, saved views, and bulk actions for steady-state power users.
- Test the three-column workspace at mobile/tablet widths and with chat open.

## 8. Dependency-sorted build order

1. Completed: WP-00 snapshot repair, WP-01 compression/splitting, WP-04 seed evals, WP-05 Responses migration, and WP-12 first-party static localization.
2. Continue WP-04 with production-derived evals and live quality/cost baselines.
3. WP-11 abuse/cost/audit foundations.
4. WP-06 evidence cards and WP-07 stage-aware chat status.
5. WP-02 progressive data readiness and worker.
6. WP-08 goal artifact using the new namespaced ApplicationStorage tool, then WP-09 comparison workspace.
7. WP-10 return continuity.
8. WP-13 novice/expert information architecture.

WP-03's universal command proposal/confirmation layer is removed from the build order by product decision.

Every slice must include current-locale catalog entries, empty/loading/error/first-run states, derived tests, support events, and explicit deferrals.

## 9. Surface/shadow/evolution test for the top changes

| Work package | Surface now | Shadow capability | Evolution |
|---|---|---|---|
| Compression/splitting | page appears faster | performance budgets and negotiated assets | supports richer features without regressing first load |
| Immediate action tools | low-friction applied/blocked state | validated SSE action and namespaced-memory boundaries | supports richer assistance without universal confirmation friction |
| Eval harness | fewer wrong or surprising chats | repeatable quality gate | safe model/prompt experimentation |
| Evidence answers | sources, freshness, exact diffs | truth/provenance contracts | support reconstruction and trust analytics |
| Goal artifact | personalized help | declared-preference truth model | long-term coaching and proactive alerts |
| Comparison workspace | clearer choices | comparable decision schema | saved plans and collaborative reviews |
| Locale/accessibility | readable in more contexts | catalog/recipient-locale plumbing | new locales without a rewrite |

## 10. Matrices and gate report

### M2 — Decision to walk to surface, targeted chatbot subset

| Decision | Walk | Surface | Status |
|---|---|---|---|
| ask grounded question | CW-01 | streamed chat answer | observed; evidence cards remain partial |
| set criteria | CW-02 | immediate criteria event and result count | observed |
| bulk add | CW-03 | immediate basket event with existing safeguards | observed |
| clear basket | CW-04 | immediate clear event with existing safeguard | observed |
| delete saved search | CW-05 | immediate delete event with existing safeguard | observed |
| set lender ID | CW-06 | immediate validated identity event | observed |
| save/retrieve chatbot memory | new | prefixed ApplicationStorage tool/event | observed |
| stop after side effect | CW-07 | interruption/result summary | still partial |

### M3 — State change to reveal, targeted

| Transition | Lender reveal | Support reveal | Written silence |
|---|---|---|---|
| criteria old -> new | count changes indirectly | truncated log only | no explicit diff receipt |
| basket item added/removed | basket badge/content | tool log only | none written |
| basket cleared | empty basket | tool log only | none written |
| saved search deleted | list changes | tool log only | none written |
| lender ID changed | portfolio UI changes | raw ID may log | no privacy receipt |
| application memory absent -> stored | available on later turns through agent namespace | tool/storage logs only | unrelated localStorage remains intentionally invisible |
| immediate tool event -> client state | resulting UI state | tool log only | explicit client acknowledgement remains absent |
| dataset batch published -> snapshot saved | no freshness reveal | server logs only | user silence currently implicit |

### M5 — Surface origin sample

| Surface | Origin story | Status |
|---|---|---|
| loading panel | ST-01 first-load waiting | observed |
| zero-results repair | ST-02 | observed |
| chat panel | ST-03 | observed |
| immediate action status | ST-04/CW-02..06 | partial; resulting UI is visible |
| locale selector | locale decision | observed |
| chatbot ApplicationStorage memory | returning-lender continuity | observed |
| operator timeline | ST-06 | missing; raw logs only |
| resume/what-changed | ST-07 | missing |

### Gates

| Gate | Result | Reason |
|---|---|---|
| G1 Cast | PASS targeted | 14 planes named or ruled out |
| G2 Ladders | FAIL full | inventory exists; full entry/exit ladders are not authored for every actor |
| G3 Stages | FAIL | 7 full records of 104 inventory rows |
| G4 Walks | FAIL | 7 walks; 34 tool decisions and non-chat surfaces are not exhaustively walked |
| G5 Storm | PASS targeted | 98/98 cells accounted; yields listed |
| G6 Reveals | FAIL full | resulting UI is visible, but support/client acknowledgement coverage is incomplete |
| G7 Traceability | FAIL | full surface-origin matrix not complete |
| G8 Language | PASS localization / FAIL full accessibility | Six-locale first-party static copy, hover help, AI startup/response language, default saved-search names, and coverage gates are implemented; human linguistic review, pseudo-locale, and full accessibility verification remain |
| G9 Honesty | PASS | counts, failed gates, unknowns, and unmeasured runtime claims are explicit |

## 11. Verification evidence

- npm test: 16 files passed, 133 tests passed.
- npm run eval:ai:dry: 7 fixtures valid; no paid API calls.
- npm run build: passed and generated 38 compressed assets.
- Localization/generator targeted ESLint: passed. Full legacy lint remains tracked separately from this slice.
- Build output:
  - main: 304.03 KB minified / 96.52 KB gzip.
  - eager i18n foundation: 71.97 KB / 25.25 KB gzip.
  - selected secondary-locale catalog: 52.15–54.85 KB / 20.35–21.38 KB gzip, loaded on demand.
  - Ask KivaLens lazy chunk: 144.41 KB / 44.21 KB gzip.
  - chart lazy chunk: 316.50 KB / 93.51 KB gzip.
  - CSS: 49.00 KB / 10.55 KB gzip.
  - 38 compressible files: 1,563.0 KiB source / 445.0 KiB Brotli / 511.7 KiB gzip.
- Local production-header verification:
  - Brotli, gzip, and identity variants negotiated correctly with Vary: Accept-Encoding.
  - hashed asset cache remains public, max-age=31536000, immutable; JavaScript MIME remains correct.
- Live batch 50:
  - 4 loan pages; 5.36 MB expanded JSON; ~473 KB compressed transfer.
  - 4 keyword pages; 3.69 MB expanded JSON; ~721 KB compressed transfer.
- Runtime Core Web Vitals: not measured because Chrome DevTools MCP was unavailable.
- Interactive walkthrough: not completed because the in-app browser runtime failed to establish a connection.

## 12. Open questions checkpoint

Remaining decisions for later slices:

1. Which persona is primary for the next release?
2. What exact raw-chat and digest retention periods are acceptable?
3. Should returning transcript continuity be local-only, provider-stored opt-in, or neither? (Namespaced ApplicationStorage memory is already local-only.)
4. What monthly AI budget and per-session cap should the system enforce?
5. Which goal/strategy fields should be first-class rather than free-form chatbot memory?
6. Is “portfolio coach” language acceptable, provided it never frames Kiva as an investment?
7. What are the target p95 first-result and AI response latencies?

## 13. Obligations and deliberate deferrals

- Adding alerts creates consent, unsubscribe, digest, delivery failure, locale, and support obligations.
- Adding persistent goals creates export/delete, staleness, conflict, and preference-confidence obligations.
- Adding provider-stored chat would create explicit retention, access, deletion, and OpenAI state-policy obligations; current Responses requests use store:false.
- Adding more side-effect tools requires bounded deterministic handlers and eval coverage; a universal registry/confirmation layer is not planned.
- Adding a new model is deferred until WP-04 produces representative live benchmark results.
- Runtime performance optimization beyond measured transfer/build issues is deferred until a valid trace can quantify LCP/INP/CLS and long tasks.
- Kiva-provided loan descriptions, use/activity text, and partner-research narratives intentionally remain in their source language; human review of generated first-party translations, pseudo-locale coverage, and full accessibility verification remain deferred.

This roadmap is a living projection. Code changes that alter actors, truths, commands, reveals, retention, locale, or flows must update this file and FractalFlow.lssd.md in the same turn.
