<!-- Canonical-For: . -->
<!-- Status: ACTIVE -->

# KivaLens FractalFlow Contract

Scope: product-level meaning for the KivaLens web app, data service, and Ask KivaLens agent.  
Authority: current observed behavior is marked observed; intended safety and evolution rules are marked asserted or unknown.  
Companion audit: KivaLens_LSSD_Audit_and_Roadmap.md.

```lssd
system kivalens.product {
  label: "KivaLens"
  status: observed
  confidence: 0.95
  summary: "An independent Kiva.org loan-search, comparison, basket, portfolio, RSS, and conversational-assistance product."
  contains: [@module.kivalens.search, @module.kivalens.basket, @module.kivalens.saved_searches, @module.kivalens.ai, @module.kivalens.data_refresh]
}

system kivalens.web_app {
  label: "KivaLens browser app"
  status: observed
  confidence: 0.95
  summary: "React application holding criteria, basket, saved searches, options, lender identity, and short-lived chat state."
}

system kivalens.node_server {
  label: "KivaLens Node server"
  status: observed
  confidence: 0.95
  summary: "Serves static assets, prepared Kiva data, proxy/RSS routes, Redis-backed operational state, and OpenAI chat."
}

system external.kiva {
  label: "Kiva platform"
  status: observed
  confidence: 0.95
  summary: "Authority for public loan, partner, lender, and checkout truth."
}

system external.openai {
  label: "OpenAI API"
  status: observed
  confidence: 0.95
  summary: "Produces Ask KivaLens responses and tool calls; never owns KivaLens domain mutation authority."
}

system external.redis {
  label: "Redis"
  status: observed
  confidence: 0.90
  summary: "Optional authority for warm snapshots, AI spend counters, interaction logs, and digest claims."
}

system external.google_aplus {
  label: "Google-hosted A+ research"
  status: observed
  confidence: 0.90
  summary: "Supplemental field-partner research source with its own freshness and confidence."
}

actor visitor {
  label: "Anonymous visitor"
  status: observed
  confidence: 0.95
  summary: "Uses KivaLens without a first-party account or lender ID."
}

actor lender {
  label: "Kiva lender"
  status: observed
  confidence: 0.95
  summary: "Searches, understands, shortlists, and transfers loan choices to Kiva."
}

actor returning_lender {
  label: "Returning lender"
  status: observed
  confidence: 0.85
  summary: "The lender at a later story age with persisted browser-local state and potentially stale truths."
}

actor represented_borrower {
  label: "Represented borrower / data subject"
  status: inferred
  confidence: 0.70
  summary: "A person described by public Kiva data whose representation must remain accurate, respectful, and purpose-bounded."
}

actor operator {
  label: "KivaLens operator"
  status: observed
  confidence: 0.90
  summary: "Maintains data refresh, AI availability, budget, logs, privacy responses, and incident repair."
}

actor scheduler {
  label: "KivaLens scheduler"
  status: observed
  confidence: 0.95
  summary: "Drives data refresh, background resync, cache cleanup, and internal digest work."
}

actor ask_kivalens {
  label: "Ask KivaLens agent"
  status: observed
  confidence: 0.95
  summary: "Reads permitted truth, explains and diagnoses, and may request validated immediate browser-local actions through bounded tools; Kiva remains external mutation authority."
}

actor rss_recipient {
  label: "RSS recipient without a KivaLens account"
  status: observed
  confidence: 0.90
  summary: "Consumes search results through a durable feed and then follows links to Kiva or KivaLens."
}

module kivalens.search {
  label: "Loan search"
  status: observed
  confidence: 0.95
  summary: "Filters the current fundraising dataset using a deterministic shared engine."
}

module kivalens.basket {
  label: "Local basket"
  status: observed
  confidence: 0.95
  summary: "Stores lending intentions locally and hands them to Kiva for checkout."
}

module kivalens.saved_searches {
  label: "Saved searches and RSS"
  status: observed
  confidence: 0.95
  summary: "Persists reusable criteria locally and can serialize criteria into an RSS artifact."
}

module kivalens.ai {
  label: "Ask KivaLens"
  status: observed
  confidence: 0.95
  summary: "Page-aware streaming agent over live loan, partner, portfolio, basket, and criteria context."
}

module kivalens.data_refresh {
  label: "Prepared Kiva dataset"
  status: observed
  confidence: 0.95
  summary: "Downloads, processes, publishes, caches, and incrementally refreshes fundraising loan truth."
}

capability kivalens.deterministic_filtering {
  label: "Deterministic filtering"
  status: observed
  confidence: 0.95
  summary: "One shared filter implementation is used by browser search, AI tools, and RSS."
}

capability kivalens.ai_ask_mode {
  label: "Conversational assistance"
  status: observed
  confidence: 0.95
  summary: "Answers from permitted current truth and may invoke bounded read or immediate-action tools when the lender explicitly asks."
}

capability kivalens.ai_command_mode {
  label: "Immediate validated action mode"
  status: observed
  confidence: 0.95
  summary: "Applies well-scoped browser-local UI actions immediately through existing tool events; there is no universal proposal or confirmation layer."
}

capability kivalens.support_reconstruction {
  label: "Support reconstruction"
  status: asserted
  confidence: 0.85
  summary: "Reconstructs context, prompt/schema version, tool work, emitted client events, storage events, reveals, aborts, and failures."
}

interface kivalens.api_data {
  label: "Prepared Kiva data API"
  status: observed
  confidence: 0.95
  methods: ["GET /api/start", "GET /api/partners", "GET /api/options", "GET /api/loans/:batch/:page", "GET /api/loans/:batch/keywords/:page", "GET /api/since/:batch"]
}

interface kivalens.api_chat {
  label: "Ask KivaLens SSE API"
  status: observed
  confidence: 0.95
  methods: ["GET /api/ai-enabled", "POST /api/chat"]
  summary: "Accepts page, selected loan, criteria, basket, saved-search, lender-ID, transcript, and namespaced application-storage context and streams text, UI, and storage events."
}

interface kivalens.api_admin_ai {
  label: "AI operator endpoints"
  status: observed
  confidence: 0.95
  methods: ["GET /api/ai-logs", "GET /api/ai-digest-test"]
  summary: "Current query-key endpoints; target policy requires authorization headers and non-GET side effects."
}

interface external.openai_responses {
  label: "OpenAI Responses API"
  status: observed
  confidence: 0.95
  summary: "Current streamed tool-using interface; requests use store:false, prompt_cache_key, a privacy-preserving safety_identifier, and call_id-linked function outputs."
}

truth dataset.batch {
  label: "Published dataset batch"
  lifetime: system
  authority: { mode: service, ref: @kivalens.node_server }
  visibility: [system]
  status: observed
  confidence: 0.95
  summary: "Identifies the current prepared loan packet set."
}

truth dataset.freshness {
  label: "Dataset freshness"
  lifetime: run
  authority: { mode: derived, ref: @module.kivalens.data_refresh }
  visibility: [system, public]
  status: observed
  confidence: 0.90
  summary: "Derived from the published batch and newest processed Kiva timestamps; currently under-revealed."
}

truth lender.criteria {
  label: "Current search criteria"
  lifetime: device
  authority: { mode: human, ref: @lender }
  visibility: [lender, system]
  status: observed
  confidence: 0.95
  summary: "Browser-local filtering truth sent to the server only when a feature needs it."
}

truth lender.basket {
  label: "Current local basket"
  lifetime: device
  authority: { mode: human, ref: @lender }
  visibility: [lender, system]
  status: observed
  confidence: 0.95
  summary: "Local lending intentions; Kiva remains authority for actual checkout and funded state."
}

truth lender.saved_searches {
  label: "Saved searches"
  lifetime: device
  authority: { mode: human, ref: @lender }
  visibility: [lender, system]
  status: observed
  confidence: 0.95
}

truth lender.kiva_id {
  label: "Kiva lender ID"
  lifetime: device
  authority: { mode: shared, ref: @lender }
  visibility: [lender, system, restricted]
  status: observed
  confidence: 0.90
  summary: "Declared by the lender and verified against public Kiva data; privacy-affecting."
}

truth actor.locale {
  label: "Actor locale"
  lifetime: device
  authority: { mode: human, ref: @lender }
  visibility: [lender, system]
  status: observed
  confidence: 0.95
  summary: "Persisted browser choice with browser-language then English fallback; supported values are en, es, fr, de, it, and nl."
}

truth dataset.sector_key {
  label: "Canonical sector key"
  lifetime: system
  authority: { mode: service, ref: @external.kiva }
  visibility: [lender, system]
  status: observed
  confidence: 0.95
  summary: "English Kiva sector values remain canonical for criteria, storage, filtering, search, and AI tool arguments; only displayed labels are localized."
}

truth ai.chat_session {
  label: "Chat session"
  lifetime: session
  authority: { mode: shared, ref: @ask_kivalens }
  visibility: [lender, system, restricted]
  status: observed
  confidence: 0.90
  summary: "Browser transcript restored only inside a two-minute activity window; raw turns may also enter operator logs."
}

truth ai.application_storage {
  label: "Ask KivaLens application storage"
  lifetime: device
  authority: { mode: shared, ref: @lender }
  visibility: [lender, system]
  status: observed
  confidence: 0.95
  summary: "Browser-local key/value memory restricted to the AskKivaLens: prefix, 32 safe keys, and 4 KiB per value; the agent cannot enumerate or modify unrelated localStorage."
}

truth ai.interaction_log {
  label: "AI interaction log"
  lifetime: archive
  authority: { mode: service, ref: @kivalens.node_server }
  visibility: [restricted]
  status: observed
  confidence: 0.95
  summary: "Raw/structured operator evidence with currently ambiguous retention and incomplete abort/client-ack coverage."
}

truth ai.usage_budget {
  label: "Monthly AI usage budget"
  lifetime: organization
  authority: { mode: human, ref: @operator }
  visibility: [restricted]
  status: observed
  confidence: 0.85
  summary: "Estimated from a local price map; target must reserve atomically and fail closed for unknown model prices."
}

policy immediate_action_scope on @kivalens.ai_command_mode {
  effect: require
  status: observed
  confidence: 0.95
  rule: "Explicitly requested browser-local criteria, basket, navigation, saved-search, identity, chart, and memory actions may apply immediately through validated tool handlers; a universal proposal/confirmation layer is intentionally absent."
}

policy application_storage_isolation on @ai.application_storage {
  effect: require
  status: observed
  confidence: 0.95
  rule: "The server accepts only sanitized snapshots and the client reads or writes only the fixed AskKivaLens: namespace; secrets, lender IDs, payment data, and borrower descriptions are prohibited memory content."
}

policy english_sector_authority on @dataset.sector_key {
  effect: require
  status: observed
  confidence: 0.95
  rule: "Localized sector labels never replace the English sector value used by Kiva data, deterministic filters, saved criteria, or AI tool arguments."
}

policy kiva_checkout_authority on @module.kivalens.basket {
  effect: require
  status: observed
  confidence: 0.95
  rule: "KivaLens may prepare a basket but never claims to complete checkout, transfer money, or guarantee repayment."
}

policy grounded_ai_answers on @module.kivalens.ai {
  effect: require
  status: asserted
  confidence: 0.90
  rule: "Claims about matches, selected loans, partner risk, basket, portfolio, or actions cite current permitted truth and disclose freshness or uncertainty."
}

policy recipient_locale_rendering on @kivalens.product {
  effect: require
  status: observed
  confidence: 0.95
  rule: "All first-party static UI copy—including chrome, pages, controls, tooltips, dialogs, loading/error states, default saved-search display names, accessibility labels, and Ask KivaLens startup copy—renders from a semantic catalog in the selected locale, and localized controls size to reveal their complete labels without clipping. The agent answers in the selected language. Kiva-provided loan descriptions, use/activity text, and partner-research narratives remain in their source language; canonical criteria, saved-search keys, sector values, and AI tool arguments remain English."
}

policy chat_privacy on @truth.ai.interaction_log {
  effect: require
  status: asserted
  confidence: 0.90
  rule: "Collect the minimum support/eval evidence, redact identity by default, define exact retention, log operator access, and propagate export/deletion decisions."
}

policy performance_budget on @kivalens.web_app {
  effect: require
  status: observed
  confidence: 0.95
  rule: "Hashed assets are immutable, precompressed as Brotli and gzip, negotiated by Accept-Encoding, and heavy routes/chat/chart code are split from the initial bundle; generated secondary-locale catalogs are also split and only the selected language loads."
}

obligation repair_refresh_snapshot on @module.kivalens.data_refresh {
  status: observed
  confidence: 0.95
  summary: "Post-publish snapshot scheduling uses retained state.allLoans length after the processed collection is released, preventing the former null dereference."
}

obligation add_ai_evals on @module.kivalens.ai {
  status: asserted
  confidence: 0.95
  summary: "An initial seven-case dry/live Responses eval harness and architecture tests exist; representative production-derived cases must continue to gate prompt, schema, tool, API, and model changes."
}

obligation bound_ai_abuse on @interface.kivalens.api_chat {
  status: asserted
  confidence: 0.90
  summary: "Rate, concurrency, body, token, tool-round, and budget limits are enforced with privacy-preserving safety identifiers."
}

obligation make_chat_accessible on @view.kivalens.chat_panel {
  status: asserted
  confidence: 0.90
  summary: "Streaming status, responses, errors, applied-action status, and charts have keyboard and screen-reader-equivalent presentations."
}

obligation keep_locale_catalog_complete on @kivalens.product {
  status: observed
  confidence: 0.95
  summary: "Catalog tests require all six locale values for static translation calls, configuration-driven labels and hover help, AI startup copy, default saved-search names, JSX copy, dialogs, and accessibility attributes."
}

flow kivalens.initial_data_load {
  label: "Initial prepared-data load"
  status: observed
  confidence: 0.95
  entry: app_started
  terminal: usable_or_fallback

  state app_started
  state reading_start_manifest
  state loading_partners_and_loan_pages
  state processing_all_loan_pages
  state usable
  state loading_keyword_pages
  state enriched
  state fallback_to_kiva
  state failed

  transition app_started -> reading_start_manifest on init
  transition reading_start_manifest -> loading_partners_and_loan_pages on manifest_ready
  transition loading_partners_and_loan_pages -> processing_all_loan_pages on responses_arrive
  transition processing_all_loan_pages -> usable on all_loan_pages_processed
  transition usable -> loading_keyword_pages on descriptions_enabled
  transition loading_keyword_pages -> enriched on keywords_merged
  transition reading_start_manifest -> fallback_to_kiva on prepared_api_unavailable
  transition fallback_to_kiva -> failed on kiva_failure
}

flow kivalens.ai_turn_current {
  label: "Current Ask KivaLens Responses turn"
  status: observed
  confidence: 0.95
  entry: user_submitted
  terminal: done_or_aborted

  state user_submitted
  state responses_streaming
  state collecting_output_items
  state executing_server_tool
  state emitting_client_event
  state appending_function_output
  state done
  state aborted
  state failed

  transition user_submitted -> responses_streaming on post_chat
  transition responses_streaming -> collecting_output_items on response_completed
  transition collecting_output_items -> executing_server_tool on function_call_output_item
  transition executing_server_tool -> emitting_client_event on browser_local_action
  transition executing_server_tool -> appending_function_output on read_tool
  transition emitting_client_event -> appending_function_output on event_written
  transition appending_function_output -> responses_streaming on call_id_output_appended
  transition responses_streaming -> done on final_output_text
  transition responses_streaming -> aborted on client_disconnect
  transition responses_streaming -> failed on response_failed_or_error
}

flow kivalens.ai_application_storage {
  label: "Ask KivaLens browser-local memory"
  status: observed
  confidence: 0.95
  entry: storage_snapshot_received
  terminal: persisted_returned_or_blocked

  state storage_snapshot_received
  state memory_tool_requested
  state namespace_validated
  state storage_event_emitted
  state value_returned
  state blocked

  transition storage_snapshot_received -> memory_tool_requested on save_or_retrieve_call
  transition memory_tool_requested -> blocked on invalid_key_size_or_count
  transition memory_tool_requested -> namespace_validated on safe_prefixed_scope
  transition namespace_validated -> storage_event_emitted on save_request
  transition namespace_validated -> value_returned on retrieve_request
}

flow kivalens.dataset_refresh {
  label: "Dataset refresh and snapshot"
  status: observed
  confidence: 0.95
  entry: scheduled
  terminal: snapshot_saved_or_failed

  state scheduled
  state fetching
  state processing
  state published
  state snapshot_pending
  state snapshot_saved
  state failed_after_publish
  state failed_before_publish

  transition scheduled -> fetching on refresh_tick
  transition fetching -> processing on source_data_ready
  transition fetching -> failed_before_publish on source_failure
  transition processing -> published on batch_atomic_publish
  transition published -> failed_after_publish on post_publish_exception
  transition published -> snapshot_pending on post_publish_complete
  transition snapshot_pending -> snapshot_saved on redis_write
}

view kivalens.search_workspace for @lender {
  label: "Search workspace"
  status: observed
  confidence: 0.95
  summary: "Criteria, virtualized results, and loan detail arranged as a dense three-column workspace with loading and zero-result repair states."
  reveals: [@dataset.freshness, @lender.criteria]
  commands: [set_criteria, reset_criteria, add_to_basket, bulk_add_to_basket]
}

view kivalens.chat_panel for @lender {
  label: "Ask KivaLens panel"
  status: observed
  confidence: 0.95
  summary: "Streaming page-aware Responses chat with Markdown, charts, immediate browser-local actions, namespaced memory, stop/reset/minimize, and logging disclosure."
  reads: [@lender.criteria, @lender.basket, @lender.saved_searches, @lender.kiva_id, @ai.chat_session, @ai.application_storage]
  commands: [ask, stop, reset_chat, save_application_storage, retrieve_application_storage]
}

view kivalens.locale_selector for @lender {
  label: "Locale selector"
  status: observed
  confidence: 0.95
  summary: "Globe dropdown displays native language names and switches chrome plus displayed sector labels among English, Español, Français, Deutsch, Italiano, and Nederlands."
  reads: [@actor.locale, @dataset.sector_key]
}

view kivalens.operator_timeline for @operator {
  label: "Redacted support reconstruction timeline"
  status: asserted
  confidence: 0.85
  summary: "Reconstructs AI and refresh stories without exposing unrestricted raw logs by default."
  reads: [@ai.interaction_log, @ai.usage_budget]
}

realization kivalens.react_vite for @kivalens.web_app {
  label: "React 19 / Vite 8 / Zustand"
  status: observed
  confidence: 0.95
  sourceRefs: [@artifact.src_app, @artifact.src_chat, @artifact.src_stores]
}

realization kivalens.node_openai for @module.kivalens.ai {
  label: "Node OpenAI SDK with Responses streaming and SSE"
  status: observed
  confidence: 0.95
  sourceRefs: [@artifact.server_ai_chat, @artifact.server_ai_usage, @artifact.ai_evals]
}

artifact src_app {
  label: "src/App.tsx"
  status: observed
  confidence: 0.95
  path: "src/App.tsx"
}

artifact src_chat {
  label: "AskKivaLens React surface"
  status: observed
  confidence: 0.95
  path: "src/components/AskKivaLens/AskKivaLens.tsx"
}

artifact src_stores {
  label: "Zustand stores"
  status: observed
  confidence: 0.95
  path: "src/stores"
}

artifact server_ai_chat {
  label: "Ask KivaLens server agent"
  status: observed
  confidence: 0.95
  path: "server/aiChat.mjs"
}

artifact server_ai_usage {
  label: "AI usage and interaction log"
  status: observed
  confidence: 0.95
  path: "server/aiUsage.mjs"
}

artifact server_core {
  label: "Prepared Kiva data service"
  status: observed
  confidence: 0.95
  path: "server/klCore.mjs"
}

artifact server_prod {
  label: "Production static/API server"
  status: observed
  confidence: 0.95
  path: "server/prod.mjs"
}

artifact src_i18n {
  label: "Locale catalog and provider"
  status: observed
  confidence: 0.95
  path: "src/i18n/index.tsx"
}

artifact src_ai_storage {
  label: "Ask KivaLens ApplicationStorage boundary"
  status: observed
  confidence: 0.95
  path: "src/lib/applicationStorage.ts"
}

artifact ai_evals {
  label: "Ask KivaLens Responses eval fixtures"
  status: observed
  confidence: 0.95
  path: "evals/ask-kivalens.json"
}

artifact static_compression {
  label: "Static Brotli/gzip build step"
  status: observed
  confidence: 0.95
  path: "scripts/compress-dist.mjs"
}

artifact lssd_audit {
  label: "KivaLens LSSD audit and roadmap"
  status: observed
  confidence: 0.95
  path: "KivaLens_LSSD_Audit_and_Roadmap.md"
}

question primary_persona on @kivalens.product {
  status: unknown
  confidence: 0.20
  summary: "Is the next release optimized first for new, occasional, or expert/mega lenders?"
}

question chat_retention on @truth.ai.interaction_log {
  status: unknown
  confidence: 0.20
  summary: "What exact retention periods govern raw Redis logs, rolling logs, and emailed digests?"
}

question conversation_continuity on @truth.ai.chat_session {
  status: unknown
  confidence: 0.20
  summary: "Should continuity be current-tab, optional local summary, provider-stored opt-in, or deliberately absent?"
}

question ai_success_targets on @module.kivalens.ai {
  status: unknown
  confidence: 0.20
  summary: "What task-success, p95 latency, and cost-per-success thresholds gate model/API changes?"
}
```
