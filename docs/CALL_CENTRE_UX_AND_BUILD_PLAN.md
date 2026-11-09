# Beverly Support Centre — Product, UX and Delivery Plan

## Objective

Make Beverly the support team's system of record: every phone call, email, chat and follow-up is connected to the correct customer, meter, wallet activity and case. Voice is the launch channel; WhatsApp is explicitly out of scope.

The experience is designed for agents working under pressure. It is calm, dense, keyboard-friendly and action-led; the live queue and the next safe action are always clear.

## Recommended communications architecture

Use **Africa's Talking** as the Nigeria-first carrier and communications API, with Beverly's own agent workspace, case system and reporting as the application layer.

Why this is the default recommendation:

- It explicitly offers Voice in Nigeria, plus IVR, call-centre building blocks, recording and callback-driven voice control.
- It keeps the customer experience on local communications infrastructure while Beverly retains its own operational data model and reporting.

Keep the provider behind a `communications_provider` adapter. Twilio Flex remains the strong fallback for a multinational operation that needs a mature ready-made contact-centre product, dual-channel recording and built-in workforce analytics, but its published Nigeria outbound voice rate is materially higher and number availability/compliance must be confirmed during procurement.

## Roles and access

| Role | Core abilities |
|---|---|
| Agent | Receive and make calls, work assigned cases, send approved templates, create field/finance requests. |
| Senior agent | Reassign, approve limited goodwill actions, review simple escalations. |
| Supervisor | Live queue control, agent presence, transfer/escalate work, coaching and quality assurance. |
| Quality analyst | Read recordings/transcripts, score interactions, create coaching tasks. No wallet mutations. |
| Finance support | Resolve payment and wallet exceptions through existing controlled workflows. |
| Field dispatcher | Accept field work, update visit status and proof of resolution. |
| Administrator | Routing, business hours, templates, taxonomies, retention and role configuration. |

All recording playback, transcript export, customer search and case mutations are audited. Finance or vending actions must remain within the existing maker-checker and idempotent workflows.

## Portal and information architecture

The live call-centre experience is a dedicated Beverly portal at **`beverly.acoblighting.com/support-centre`**. It shares Beverly staff sign-on, customer, meter, wallet, case and audit data, while keeping live call controls, recordings and supervisor operations separate from everyday CRM and finance work.

## End-to-end Support Centre pipeline

```text
Customer call
  → IVR and consent
  → identity / account match
  → priority and skills-based queue
  → agent Live Desk + customer/meter/wallet context
  → case investigation and approved resolution workflow
  → transfer, supervisor or finance/field escalation when needed
  → customer update and callback management
  → resolution confirmation and survey
  → recording, quality review and coaching
  → operational, SLA and trend reporting
  → root-cause action and incident prevention
```

Every stage must remain connected through one interaction and case timeline. A support agent never needs to leave Support Centre to understand the customer, perform a permitted resolution, hand work off, or document the outcome.

```
Support Centre
├── Live desk             agent's active call and customer context
├── Queue                 waiting, assigned and callback work
├── Cases                 all customer issues and escalations
├── Customers             360-degree customer and meter/account history
├── Incidents             widespread outages and communications
├── Field & finance handoffs approved escalations, ownership and outcomes
├── Quality               recordings, scorecards and coaching
├── Analytics             real-time and historical performance
└── Administration        routing, SLA, templates, teams and retention
```

On desktop, this is a persistent left sidebar. On tablets, the queue remains visible in a collapsible rail. On mobile, agents see their active task first and use a labelled bottom bar for Home, Queue, Cases, Search and More.

## Proposed screens

### 1. Live Desk — the primary agent screen

**Purpose:** resolve an active interaction without hunting across systems.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Support / Live desk       Available ▾          Search customer or case        │
├───────────────┬──────────────────────────────┬────────────────────────────────┤
│ QUEUE (12)    │ ACTIVE CALL                  │ CUSTOMER 360                    │
│ 00:42 Ada O.  │ Ada Okafor · +234…           │ Ada Okafor · CUS-10482           │
│ 01:16 Musa K. │ Recording ●  04:18           │ Meter BVL-00291 · Active          │
│ 02:03 Kelechi │ [Mute] [Hold] [Transfer]     │ Balance · recent vend · tariff    │
│               │ [End call]                   │                                  │
│ Callbacks (3) ├──────────────────────────────┤ Open cases                      │
│ 10:30 Ngozi   │ CASE                          │ CS-2931 Token not received        │
│               │ Token delivery · High         │ Last payment: verified 09:41      │
│               │ SLA due in 26 min             │                                  │
│               │ Notes / approved reply        │ Timeline                          │
│               │ [Resolve] [Escalate]          │ calls · messages · payments       │
└───────────────┴──────────────────────────────┴────────────────────────────────┘
```

- Left rail: ordered by urgency; waiting time, channel, intent and SLA badge are visible before accepting.
- Centre: call controls, consent/recording state, a single case composer and the next recommended action.
- Right rail: customer identity, account/meter/wallet summary, warnings and a chronological timeline.
- A payment or vending card only exposes safe status and links to the existing authorised recovery flow—no uncontrolled financial action from the call screen.

### 2. Incoming call screen-pop

**Purpose:** identify the caller before the agent accepts.

- Large caller name/number, account match confidence and previous-contact warning.
- One primary action: **Accept**. Secondary actions: decline with reason, transfer to voicemail, or open a duplicate case warning.
- If unknown, show a fast identity form: account phone, meter number or customer ID. Never create a new person record automatically from an unverified number.

### 3. Queue and workboard

**Purpose:** allow agents and supervisors to see waiting work, capacity and SLA risk.

- Tabs: My work, Voice, Email, Callbacks, Unassigned and Escalated.
- Filter chips: queue, channel, priority, issue category, station/area, language, team and SLA state.
- Rows: customer, reason, channel, waiting/age timer, owner, priority and SLA state.
- Supervisor-only bulk actions: reassign, change priority, announce incident, pause a queue.

### 4. Case workspace

**Purpose:** make investigation, ownership and closure unambiguous.

- Header: case ID, status, priority, SLA countdown, owner and linked incident.
- Tabs: conversation, customer context, activity, linked orders/payments, field work, files and audit.
- Required resolution fields: category, root cause, resolution code, customer notification result and next action.
- Closing is blocked when a required confirmation is missing; a reopened case keeps its original history.

### 5. Customer 360

**Purpose:** give a trusted profile without burying the agent in data.

- Identity and consent status; linked premises, meters and contact methods.
- Compact wallet and purchase snapshot; last known delivery/purchase states; active fault and fraud/risk notices.
- Interaction timeline with channel icons and recording/transcript links subject to role permission.
- The page uses progressive disclosure: normal support context first, deeper finance or telemetry evidence only when needed.

### 6. Incident command centre

**Purpose:** control a high-volume outage or known fault without creating hundreds of disconnected tickets.

- Status banner: investigating, identified, monitoring, resolved.
- Affected sites/customers, related contacts, age, owner and next public update time.
- Approved customer message templates with preview; publishing requires the named incident commander.
- Incoming contacts are linked to the incident and receive an agent-facing resolution script.

### 7. Supervisor live operations

**Purpose:** make intervention timely and defensible.

- Queue health: offered, answered, abandoned, longest wait, active calls, callbacks due and breached SLA.
- Agent grid: availability, active interaction, time in state, current workload and assist request.
- A separate intervention drawer supports monitor/coach/transfer actions with a reason and audit event.
- Alerts are textual and icon-supported; colour is never the only severity signal.

### 8. Quality review

**Purpose:** turn recordings into repeatable coaching.

- Recording player and timestamped transcript; customer and agent channels are clearly separated where available.
- Scorecard: greeting, verification, diagnosis, accuracy, tone, policy compliance, resolution and documentation.
- A coaching action has owner, due date, acknowledgement and follow-up review.

### 9. Analytics

**Purpose:** make service health actionable rather than decorative.

- Today: service level, average speed of answer, abandonment, first-contact resolution, backlog, reopened cases and customer satisfaction.
- Trends: line charts for volume and service level; horizontal bars for issue categories; funnel for contact-to-resolution; table export for all underlying data.
- Every metric displays its definition, time range, queue filters and last refresh. Charts have table alternatives and accessible summaries.

### 10. Administration

**Purpose:** configure without changing code.

- Routing rules: business hours, holidays, language, customer segment, issue type, location, overflow and callback behaviour.
- Work management: teams, skills, queues, capacity and case/SLA policies.
- Communications: verified numbers, IVR version, voice prompts, recording consent prompt and retention policy.
- Changes are versioned, previewable and published with an audit log.

## Primary UX flows

### A. Inbound call: payment completed but token missing

```text
Call arrives → identify phone/account → display payment and purchase context
→ agent accepts → recording consent announcement recorded
→ case is matched or created → agent follows approved recovery guidance
→ payment/order evidence is linked → controlled recovery or finance escalation
→ customer receives the result by voice or email/SMS → case closes or awaits owner
```

Automation rules:

1. Match the caller by verified phone; otherwise require customer/meter verification.
2. Detect an existing unresolved payment/token case and present it rather than duplicating it.
3. Read payment and vending state only; an agent cannot retry a payment or release value from the call screen.
4. When the recovery workflow completes, send a customer update and record delivery evidence on the case.

### B. Meter fault requiring a field visit

```text
Contact → verification → case categorised as meter fault
→ guided diagnostic questions + available telemetry context
→ remote resolution if eligible; otherwise field job created
→ dispatcher assigns team and visit window → customer receives appointment
→ field proof / resolution update → agent confirms outcome → survey and closure
```

### C. Major incident

```text
Signal or supervisor report → incident created → scope and owner confirmed
→ customer-safe message approved → inbound contacts are linked automatically
→ queue script and voice/email/SMS updates are published
→ recovery verified → final update → incident review and trend report
```

## Design system and interaction rules

- Match existing Beverly personality: calm, precise and accountable. Use existing semantic tokens; do not introduce raw per-screen colours.
- Use a restrained operational palette: Beverly blue/ink for primary action, amber for attention, red for confirmed risk, teal/green for confirmed completion. Every coloured state includes an icon and label.
- Base text is 16px; data cells may use 14px only when contrast and row height remain readable. Use tabular figures for timers, money and IDs.
- Use an 8px spacing rhythm. Touch targets are at least 44×44px. The visible keyboard focus ring is never removed.
- Each screen gets one primary action. Secondary actions move to a menu rather than competing with the main work.
- Place validation errors beside their field. For long forms, save drafts and warn before discarding unsaved work.
- Use 150–300ms transform/opacity transitions only; honour reduced motion. Queues update without moving the item being actively inspected.
- Support 375px, 768px, 1024px and 1440px layouts. Desktop uses a sidebar; mobile preserves the active interaction and defers nonessential panels.
- Empty states tell the agent what to do next; loading uses reserved-space skeletons, and failure states offer retry plus a safe fallback.

## Data model

| Entity | Essential fields |
|---|---|
| `support_cases` | customer, status, priority, category, owner, SLA timestamps, resolution, source interaction, incident. |
| `support_interactions` | channel, provider ID, direction, participants, time, queue, agent, outcome, case. |
| `call_recordings` | interaction, secured storage reference, consent, duration, retention/deletion timestamp, access audit. |
| `interaction_transcripts` | recording, provider version, language, segments, confidence, redactions, summary. |
| `support_queues` / `routing_rules` | queue, skills, capacity, hours, priorities, conditions and versions. |
| `support_slas` | policy, category/priority scope, first-response and resolution targets, breach workflow. |
| `support_incidents` | status, scope, commander, public update, linked cases, timeline and post-incident review. |
| `field_jobs` | case, location/meter, dispatcher, appointment, assigned crew, proof and completion state. |
| `quality_reviews` / `coaching_actions` | reviewed interaction, scorecard, reviewer, result, assignee and due date. |

Provider payloads must enter through a verified webhook ingestion layer, be deduplicated by provider event ID and stored as raw evidence separately from the canonical support records.

## Integration boundaries

| Integration | Beverly responsibility |
|---|---|
| Voice provider | Signed webhook verification, ID mapping, status-event idempotency, recording retrieval and failure handling. |
| CRM/customer and meter data | Read-only context for agents; verified links back to the existing customer, meter and installation records. |
| Wallet, payments and vending | Read existing status and invoke only existing, authorised recovery/approval commands. |
| Notifications | Approved templates, channel preference/consent, delivery evidence, retry policy and opt-out. |
| Storage/transcription | Encrypted media, restricted signed playback URLs, redaction, retention and deletion jobs. |

## Delivery sequence

### Release 0 — decisions and foundations

- Provider proof-of-concept: Nigeria number, inbound/outbound call, IVR, queue, recording and webhook verification.
- Define case taxonomy, SLA matrix, support hours, escalation ownership, recording consent wording and retention policy.
- Add provider adapter, webhook event store and support data model behind role-based access control.

### Release 1 — agent operations

- Live Desk, screen-pop, call controls, queue/workboard, customer 360 and core case management.
- Integrate payment, purchase, wallet and meter context as safe read-only panels.
- Launch voice with recordings and baseline real-time reporting.

### Release 2 — resolution workflows

- Payment/token exception flows, field-job dispatch, callbacks, incident command centre, email integration and customer notifications.
- Add supervisor controls, SLA breach automation and auditable templates.

### Release 3 — quality and optimisation

- Transcription/summaries with human review, quality scorecards, coaching, CSAT, historical analytics, exports and trend-driven automation.

## Acceptance criteria for launch

- An inbound call creates exactly one interaction event and is either linked to one verified customer or explicitly marked unknown.
- A case has accountable ownership, a visible SLA and a complete audit trail.
- Recording consent and retention rules are applied before media is stored; playback is permission-controlled and logged.
- Duplicate provider webhooks cannot create duplicate interactions, cases, refunds, vends or notifications.
- Agents can see relevant customer, meter, payment and purchase context without receiving extra permission to mutate financial records.
- Supervisors can identify a queue breach and act from one screen.
- Reports reconcile with the canonical interaction and case records, expose their definitions and permit export.
