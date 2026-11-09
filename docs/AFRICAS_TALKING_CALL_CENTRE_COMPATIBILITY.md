# Africa's Talking voice for Beverly — End-to-End Compatibility Research

**Decision:** compatible, with a voice-first integration. Africa's Talking should provide the Nigeria public number and carrier services; Beverly's dedicated **Support Centre** at `beverly.acoblighting.com/support-centre` remains the agent desktop, customer context, case system, reporting surface and source of truth. WhatsApp is out of scope.

## What Africa's Talking provides

| Capability | Evidence-based status | Beverly implication |
|---|---|---|
| Nigeria virtual number | Available through the Voice Service Request process. | One public Beverly support number can receive calls from customers. |
| IVR | Supported with VoiceXML callback actions and DTMF. | Beverly serves the call-flow instructions: greeting, consent, language and menu/routing. |
| Queueing | Supported through enqueue/dequeue call actions and events. | Beverly defines queue priority and SLA; provider handles waiting callers. |
| Transfer and conference | Supported Voice events include transfer and conference; call flow supports dialling SIP/phone destinations. | Agents can transfer to finance, technical support or a supervisor. |
| SIP endpoints/trunks | Supported; AT will share SIP details and whitelist a supplied PBX IP for trunking. | Agents can answer through controlled softphones rather than personal mobile numbers. |
| Call recording | Supported, with 48-hour provider retention. | Beverly must fetch and secure recordings immediately after the call. |
| Call lifecycle events | Provider posts events for active, dialing, ringing, bridged, completed, enqueued and dequeued states. | The live queue, timeline and reports can be event-driven. |
| Concurrent calls | Provider recommends up to 40 simultaneous calls and releases new calls at one per second. | More than adequate for Beverly's current ~4,397-customer fleet; use provider confirmation before a major expansion. |

Africa's Talking is not the agent desktop or case-management system. Its own call-centre guidance explicitly says that routing is performed by an application built by the customer. Beverly must therefore implement the operational layer.

## Compatibility with the current Beverly platform

| Beverly capability | Current state | Compatibility assessment |
|---|---|---|
| Staff interface | Vue 3 administrative CRM with roles, sidebar navigation and shared design tokens. | Strong fit for Live Desk, queues, cases, supervisor and analytics routes. |
| API layer | Node/Fastify wallet service, guarded mutation policy and explicit route contracts. | Strong fit for authenticated support APIs and an isolated provider webhook endpoint. |
| Data and identity | Supabase-backed customers, meters, wallets, purchases and staff roles. | Strong fit for screen-pop and Customer 360; customer/meter information can be read in-context without granting financial write access. |
| Async work | BullMQ and Redis queues plus dedicated workers exist. | Strong fit for recording download, transcription, notifications, reconciliation and SLA jobs. |
| File storage | Existing storage adapter and retention practices. | Suitable for protected recording/transcript evidence after a capacity and retention review. |
| Live client updates | Current deployment permits Supabase WebSocket connections. | Suitable for agent-presence, queue and call-state updates. |
| Existing telephony code | `twilio` is listed as a backend dependency but has no active use in the application code. No Africa's Talking integration exists. | No migration conflict, but all call-control, webhook, case and recording modules are new work. |
| Vercel-facing API | Serverless proxy routes and short-lived request model. | Fine for webhooks and normal support APIs; unsuitable as the persistent SIP/WebRTC/media plane. |

## Recommended production architecture

```text
Customer phone
     │
     ▼
Africa's Talking virtual number ── IVR / carrier / PSTN
     │ SIP trunk or VoiceXML callbacks
     ▼
Dedicated telephony gateway / PBX  ◄── agent browser softphones
     │                  │
     │ events           │ recordings
     ▼                  ▼
Beverly Fastify API ──> Supabase + protected media storage
     │                  │
     ├── Vue Live Desk ─┘
     └── BullMQ workers: recording fetch, transcript, SLA, reports
```

### Why a dedicated telephony gateway/PBX is recommended

Africa's Talking documents SIP phones and SIP trunks, but its public material does **not** establish browser-WebRTC interoperability or an embedded softphone SDK for Beverly. A PBX or managed SIP/WebRTC gateway gives Beverly a stable media and call-control plane: agent registration, WebRTC browser audio, hold, attended/warm transfer, conferences, device reconnects and failover. Beverly then consumes secure call events and exposes controls in the Vue interface.

Direct VoiceXML callbacks are viable for a small IVR and basic dial/queue flow. They are not the preferred path for a full supervisor-and-agent interface, because a serverless application should not own long-lived SIP registrations or live audio streams.

Before procurement, obtain written confirmation from Africa's Talking on either:

1. supported SIP/WebRTC browser-client details, or
2. SIP-trunk interoperability with the chosen PBX, permitted codecs, regional media routing, failover, concurrent calls and static IP requirements.

## How the core call flows work

### Incoming call and agent routing

1. A customer dials the Beverly virtual number.
2. Africa's Talking requests Beverly's configured call callback URL, or routes the call to the whitelisted SIP trunk.
3. Beverly identifies the caller by verified phone number; otherwise it starts a safe account/meter verification step.
4. The routing engine selects a queue using business hours, language, issue type, customer area and priority.
5. An available agent receives the live task and screen-pop in the Beverly Live Desk.
6. Acceptance bridges the call. Events update the interaction timeline, agent state and supervisor board.
7. End-of-call creates or updates the case, requires a disposition, starts applicable SLA timers and schedules recording ingestion.

### Transfer and supervisor assistance

1. The agent presses Transfer in Beverly and selects a team, named agent or supervisor.
2. Beverly requests the PBX/provider to place the original customer on hold and dial the destination.
3. For a warm transfer, the first agent speaks to the receiving agent before completing the bridge.
4. For a conference, the PBX adds the supervisor or specialist while preserving the original interaction/case ID.
5. All legs, transfer reasons and the final owner appear in the audit timeline.

### Recording and quality workflow

1. The IVR announces recording consent before agent connection, subject to legal review.
2. Recording begins; its provider reference is tied to the interaction ID.
3. When completion arrives, a worker downloads the media well within Africa's Talking's 48-hour provider retention period.
4. The file is virus-scanned if tooling permits, encrypted at rest in Beverly-approved private storage, then the provider copy is deleted or left only for the minimum permitted window.
5. A controlled transcription job creates a redacted transcript and summary. Playback uses short-lived, access-checked signed URLs; every access is audited.

## Security and reliability requirements

- Store Africa's Talking credentials only in server-side secret storage. Never put them in the Vue app or expose them in logs.
- Use a dedicated webhook route with strict content-type/size limits, a unique secret path and provider-origin protections. Africa's Talking's published guidance discusses API-key/username protection and SIP IP allowlisting, but does not demonstrate a modern signed-callback scheme; confirm available webhook authentication in writing and add compensating controls if signatures are unavailable.
- Persist raw callback payloads as restricted evidence, deduplicate provider event IDs/session IDs, and make all completion events idempotent.
- Acknowledge provider webhooks quickly, then process expensive work through BullMQ. Retries must not create duplicate cases, transfers, notifications or financial actions.
- Existing Beverly money routes remain separate. The call-centre UI can show payment/order state and initiate a controlled escalation, never directly repeat or approve a payment/vend.
- Set low-wallet alerts. Africa's Talking suspends services when the wallet is zero/negative and can deactivate a voice number after non-payment.
- Track callback latency, IVR failures, queue age, dropped/aborted calls, webhook retries, SIP registration health, recording-download age and storage failures.

## Cost to start — voice only, no WhatsApp

| Item | Other-telcos regular number | MTN regular number |
|---|---:|---:|
| Setup | ₦0 | ₦6,000 + 7.5% VAT = ₦6,450 |
| First month number rental | ₦5,000 + 7.5% VAT = ₦5,375 | ₦10,000 + 7.5% VAT = ₦10,750 |
| **Minimum number cost to start** | **₦5,375** | **₦17,200** |

Both options additionally require wallet credit for usage. Published Nigeria usage prices are ₦5/minute incoming (all telcos), ₦15/minute regular outgoing to other telcos, ₦20/minute regular outgoing to MTN, ₦3/minute SIP outgoing and ₦1/minute for a conference participant.

**Recommended pilot funding:** purchase one other-telcos regular number and fund **₦25,000** for usage. This makes the immediate voice budget **₦30,375** before hardware/PBX costs and gives a small team enough credit to test IVR, routing, transfers and normal early usage. Use an MTN number only when Africa's Talking confirms it is necessary for the desired number type or caller experience.

There is no published allocated-minute bundle in the Nigeria voice sheet. Africa's Talking bills usage from a prepaid wallet; its guidance says wallet balance does not expire. Unused wallet value therefore carries forward, while number rental is deducted monthly and is not recoverable as unused minutes.

## Procurement and rollout checklist

1. Create the Africa's Talking account and request a **voice test number** first; the normal sandbox is not operational for Voice.
2. Submit the Voice Service Request. Africa's Talking sends an online contract and invoice; the number is allocated after payment.
3. Provide organisation/KYC material requested in the service order, select the number type and fund the wallet.
4. Ask Africa's Talking for a written technical confirmation covering number type, all-network reachability, concurrent call capacity, SIP credentials, media codecs, whitelisted PBX IPs, webhook authentication, recording retrieval and price/tax treatment.
5. Deploy the telephony gateway/PBX; do not use a developer laptop or the Vercel serverless function as the permanent SIP host.
6. Build the provider adapter, event store, cases/interactions schema, Live Desk and secure recording pipeline.
7. Run a controlled pilot: 2–5 agents, normal and unknown callers, IVR, queue overflow, warm/cold transfer, conference, callback, recording recovery, wallet exhaustion and outage drills.
8. Launch with a published service schedule, escalation policy, retention schedule, quality scorecard and daily queue-health review.

## Open commercial questions to resolve before signing

- Exact number availability and provisioning lead time for Beverly's preferred Nigerian prefix/type.
- Whether the number plan can handle the expected inbound concurrency and whether limits are contractual.
- SIP user/PBX fees, if any, and the cost/terms for transfer, queue and recording beyond published per-minute charges.
- Whether per-minute rates include VAT and any rounding/minimum-duration rule.
- Provider webhook authentication and static source IP ranges.
- Recording-download API, media format, retention/deletion controls and any cost beyond the stated 48-hour provider window.
- Support/SLA response time and an escalation contact for a production outage.

## Sources consulted

- Africa's Talking Nigeria Voice Pricing (June 2026): https://help.africastalking.com/en/articles/15433615-voice-pricing-nigeria
- Voice Number Request/Acquisition: https://help.africastalking.com/en/articles/13762314-voice-number-request-acquisition
- Call-centre setup: https://help.africastalking.com/en/articles/2900658-what-you-need-to-build-a-call-center
- SIP-trunk requirements: https://help.africastalking.com/en/articles/6049012-what-do-i-need-to-set-up-a-sip-trunk-connection
- Concurrent calls: https://help.africastalking.com/en/articles/1205758-how-many-concurrent-calls-can-i-make-per-second
- Recording retention: https://help.africastalking.com/en/articles/5947766-when-using-the-voice-api-to-record-calls-what-is-the-maximum-duration-that-the-recordings-will-stay-on-the-dashboard-and-is-there-a-limit-on-the-size-of-recordings
- Wallet carry-over and billing: https://help.africastalking.com/en/articles/11785000-billing-plans-top-up-based-pricing
- Monthly maintenance schedule: https://help.africastalking.com/en/articles/11785134-monthly-maintenance-fee-deductions-schedule
