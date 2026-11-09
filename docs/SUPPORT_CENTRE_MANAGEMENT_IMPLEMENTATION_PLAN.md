# Beverly Support Centre
## Management Review and Implementation Plan

**Prepared for:** ACOB Senior Management  
**Status:** Decision required before build  
**Proposed launch channel:** Voice only  
**Portal:** `beverly.acoblighting.com/support-centre`

---

## 1. Decision requested

Approve a phased implementation of **Beverly Support Centre**, a dedicated staff portal for customer-support operations. It will bring telephone calls, customer and meter context, support cases, recordings, escalations, quality reviews and management reporting into one controlled workflow.

The proposal is to use **Africa's Talking** for Nigeria voice services and a dedicated telephony gateway/PBX for live agent call control. Beverly will remain the system of record for customer, meter, wallet, purchase, case and audit information.

Management approval is requested for:

1. A voice-only pilot, beginning with one Africa's Talking virtual number.
2. Phase 0 discovery and provider technical validation.
3. A dedicated Support Centre portal at the agreed Beverly address.
4. A named business owner, operations lead, finance approver, technical lead and data-protection reviewer.
5. The proposed rollout gates and service-level targets in this plan.

WhatsApp is explicitly **out of scope** for the first release.

---

## 2. Business case

Beverly currently serves approximately **4,397 customers** across **7,686 meter records**. Customer issues often require support staff to understand a caller's meter, wallet, payment, vending/order state and prior history before giving a safe answer or handing work to Finance or Field Operations.

Without a unified operational workspace, contacts become difficult to track, ownership can be unclear, response times cannot be measured consistently and lessons from recurring issues are lost. Support Centre addresses this through a single, auditable case and interaction timeline.

### Expected outcomes

- A single official number for customer support.
- Faster and more consistent resolution of payment, token, meter and account queries.
- Clear ownership and escalation between Support, Finance and Field Operations.
- Recordings and case evidence for quality assurance, customer protection and staff coaching.
- Reliable reporting on demand, wait times, missed calls, recurring faults and service performance.
- Better visibility of incidents before they generate widespread repeat contacts.

---

## 3. Scope

### Included in the first programme

| Area | Capability |
|---|---|
| Telephony | Virtual number, IVR, queueing, call routing, hold, transfer, conference, callback and call recording. |
| Agent operations | Live Desk with live call controls, queue, caller identification, case notes and a guided resolution flow. |
| Beverly context | Read-only access to approved customer, meter, wallet, purchase and payment information during a call. |
| Case management | Ownership, priority, category, SLA timer, notes, attachments, escalation and closure evidence. |
| Handoffs | Controlled Finance and Field Operations escalations with accountable ownership and status return. |
| Supervision | Queue health, agent availability, workload, transfer support and SLA intervention. |
| Quality | Recording archive, quality scorecards, coaching tasks and review evidence. |
| Reporting | Real-time queue view plus historical service, case, SLA and root-cause reporting. |
| Governance | Role controls, consent messaging, retention rules, secure media access and audit logging. |

### Not included in the first release

- WhatsApp, social-media, chatbot or automated customer messaging channels.
- Automated financial approvals, payment retries, wallet credits or token re-vending from the agent interface.
- Full workforce management, forecasting or staff payroll.
- Customer-facing self-service portal redesign.

These may be considered after the voice pilot has met its success criteria.

---

## 4. Operating model

```text
Customer call
  → IVR, consent and caller verification
  → skills/priority-based queue
  → Support agent Live Desk
  → case diagnosis using customer, meter and wallet context
  → resolve, transfer or controlled Finance/Field escalation
  → customer update and callback where needed
  → closure evidence, recording and quality review
  → management reporting and root-cause action
```

The Support Centre will be a separate operational portal, not a page hidden inside the customer, vendor or finance portals. It will use the same Beverly staff identity, permissions and authoritative operational data.

### Roles

| Role | Accountability |
|---|---|
| Support agent | Owns a live contact and assigned case through resolution or documented handoff. |
| Support supervisor | Owns queues, service levels, reassignment, escalation and agent support. |
| Finance support | Resolves authorised payment/wallet exceptions through existing controls. |
| Field dispatcher | Owns field jobs, appointments, proof of work and return status. |
| Quality reviewer | Reviews recordings and scorecards; assigns coaching actions. |
| Support administrator | Maintains routing, business hours, teams, templates, categories and retention. |
| Management sponsor | Owns customer-service outcomes, policy decisions and investment approvals. |

---

## 5. Solution architecture

```text
Customer phone
  → Africa's Talking virtual number, IVR and carrier network
  → dedicated telephony gateway/PBX for browser softphones and live call control
  → Beverly Support Centre portal and Fastify APIs
  → Supabase customer/meter/case data and protected recording storage
  → BullMQ workers for recording retrieval, SLA jobs, notifications and reporting
```

### Why this architecture

Africa's Talking provides the Nigeria number, carrier connection, IVR, call routing primitives, SIP integration and recordings. It is not itself the complete agent desktop. Beverly therefore owns the customer experience for staff, operational logic, records and management information.

A dedicated telephony gateway/PBX is recommended because it provides reliable browser softphones, call hold, warm transfer, conference calls, agent reconnection and queue control. The current Beverly serverless-facing routes are suitable for normal APIs and event webhooks, but should not carry persistent SIP or live media traffic.

All customer payment and vending information displayed in Support Centre will be read-only. Any financial or vending action must continue through Beverly's existing controlled, auditable workflows.

---

## 6. Commercial model and initial costs

### Confirmed Africa's Talking Nigeria voice costs

| Item | Cost |
|---|---:|
| Regular virtual number — other telcos | ₦5,000/month + 7.5% VAT = **₦5,375/month**; no setup fee listed. |
| Regular MTN virtual number | ₦6,000 + VAT setup, plus ₦10,000 + VAT/month = **₦17,200 first month**, then **₦10,750/month**. |
| Incoming call | ₦5/minute, all telcos. |
| Outbound call to other telcos | ₦15/minute. |
| Outbound call to MTN | ₦20/minute. |
| SIP outbound call | ₦3/minute. |
| Conference participant | ₦1/minute. |

### Pilot recommendation

- Procure one regular **other-telcos** virtual number.
- Fund the provider wallet with **₦25,000** for live testing and initial call usage.
- Initial provider commitment: **₦30,375**.
- Recurring voice spend is usage-based; unused wallet value carries forward, while number rental is charged monthly.

The provider cost above excludes the telephony gateway/PBX, storage, transcription, internet, headsets, support staffing and implementation effort. These costs require a vendor/technical quote during Phase 0 and must be approved before the production rollout gate.

---

## 7. Delivery plan and stage gates

The programme is designed to prevent a full launch before core customer, security and operational controls are proven.

| Phase | Indicative duration | Deliverables | Gate to proceed |
|---|---:|---|---|
| **0. Validate and design** | 2 weeks | Africa's Talking number/test call, provider confirmation, PBX option, final requirements, data-protection review, call scripts, SLA matrix and costed delivery estimate. | Sponsor accepts final scope, provider quote and risk controls. |
| **1. Foundation** | 3 weeks | Support data model, roles, event/webhook ingestion, audit trail, basic customer/meter context, secure recording pipeline. | Security and data review confirms that a test interaction is correctly captured and protected. |
| **2. Live Desk pilot** | 4 weeks | Live Desk, queue, inbound/outbound calling, IVR, screen-pop, cases, transfers, callbacks and supervisor queue view. | Controlled user-acceptance test: calls, transfers, recordings, wallet read-context and failure recovery pass. |
| **3. Resolution operations** | 3 weeks | Finance and field handoffs, incident management, SLA automation, case closure controls and callback process. | Operations team proves end-to-end token/payment and meter-fault cases. |
| **4. Quality and reporting** | 3 weeks | Recordings/quality workflow, coaching, operational dashboard, scheduled reporting and post-incident review. | Management accepts pilot performance and authorises wider rollout. |

**Indicative total:** 15 weeks from approved Phase 0, excluding provider-number allocation time, procurement delays or major changes to requirements.

---

## 8. Pilot design

| Item | Proposal |
|---|---|
| Pilot group | 2–5 support agents, one supervisor, named Finance and Field Operations contacts. |
| Duration | Four weeks of live operation after successful acceptance testing. |
| Coverage | Defined support hours, one public number and selected customer/support categories. |
| Priority use cases | Token not received, payment completed but wallet/token not updated, meter fault, account/billing query and major service incident. |
| Customer protection | Call-recording consent statement, identity verification before account disclosure, role-based access and escalation-only financial actions. |
| Exit decision | Expand, remediate, pause or retire based on the agreed success measures. |

### Proposed pilot success measures

Management should approve the targets below during Phase 0.

| Measure | Proposed pilot target |
|---|---:|
| Calls answered within 30 seconds | ≥80% during staffed hours |
| Missed/abandoned calls | <10% |
| Cases with named owner and SLA | 100% |
| Calls correctly linked to customer or explicitly marked unknown | ≥95% |
| Payment/token cases resolved or correctly escalated within SLA | ≥90% |
| Recording available to authorised reviewer after completed call | ≥98% |
| Financial/vending changes initiated outside authorised Beverly workflow | 0 |
| Agent/supervisor adoption | ≥85% of pilot work processed in Support Centre |

---

## 9. Key risks and controls

| Risk | Impact | Required control |
|---|---|---|
| Provider capacity or SIP/browser incompatibility | Calls cannot be handled as designed. | Phase 0 proof of concept; obtain written SIP, capacity, codec, IP allowlist and support confirmation. |
| Recording loss | Quality/compliance evidence is unavailable. | Download recordings automatically within the provider's 48-hour retention period; monitor failed downloads. |
| Customer-data exposure | Privacy, reputational and regulatory risk. | Role-based access, verified identity steps, private storage, signed playback links, retention schedule and access audit. |
| Duplicate or forged webhooks | Incorrect cases/events or data manipulation. | Dedicated ingress, provider-origin validation, secret controls, idempotency keys, raw-event evidence and security testing. |
| Agent bypasses finance/vending controls | Financial loss or incorrect customer value. | Read-only financial context in Support Centre; actions redirect to existing approval-controlled Beverly workflows. |
| Wallet depletion or number deactivation | Support number stops working. | Low-balance alert, named owner, monthly funding review and service continuity runbook. |
| Weak adoption | No operational improvement. | Small pilot, agent scripts, supervisor coaching, daily queue review and feedback-led refinement. |

---

## 10. Governance and management cadence

| Cadence | Participants | Purpose |
|---|---|---|
| Weekly delivery review | Sponsor, technical lead, operations lead, product lead | Scope, risks, decisions and delivery progress. |
| Daily pilot huddle | Supervisor, agents, Finance/Field representatives | Queue health, incidents, escalations and operational blockers. |
| Weekly quality review | Supervisor, quality reviewer, operations lead | Recording sample, scorecards, coaching and recurring causes. |
| Monthly management report | Senior Management | Service level, demand, resolution, financial-impact cases, incidents, quality and investment recommendation. |

The management sponsor must approve changes to service hours, recording retention, customer messaging, material escalation policy and any workflow that could create financial value.

---

## 11. Approvals required before build starts

1. Confirm the business sponsor and operational owner.
2. Approve a voice-only pilot and Support Centre portal scope.
3. Approve Phase 0 and the initial provider purchase/funding of **₦30,375**.
4. Approve the policy owner for recordings, data retention and consent wording.
5. Approve the pilot support hours, escalation matrix and named Finance/Field contacts.
6. Authorise the technical team to obtain a PBX/telephony gateway quote and return with the final production cost.
7. Approve the pilot success measures or nominate amendments.

---

## Appendix: provider facts used in this proposal

- Africa's Talking has published Nigeria voice support, virtual-number acquisition, VoiceXML callback routing, SIP/trunk integration, recording, queue/transfer/conference events and a recommended concurrent-call level of up to 40 calls.
- Its Voice sandbox is not operational; a live test number is required for technical validation.
- Recordings remain on the provider dashboard for 48 hours, so Beverly must retrieve them promptly.
- Voice-number acquisition requires a service request, contract and invoice; the number is allocated after payment.

Sources: [Nigeria Voice Pricing](https://help.africastalking.com/en/articles/15433615-voice-pricing-nigeria), [Voice Number Acquisition](https://help.africastalking.com/en/articles/13762314-voice-number-request-acquisition), [Call-Centre Setup](https://help.africastalking.com/en/articles/2900658-what-you-need-to-build-a-call-center), [SIP Trunks](https://help.africastalking.com/en/articles/6049012-what-do-i-need-to-set-up-a-sip-trunk-connection), [Recording Retention](https://help.africastalking.com/en/articles/5947766-when-using-the-voice-api-to-record-calls-what-is-the-maximum-duration-that-the-recordings-will-stay-on-the-dashboard-and-is-there-a-limit-on-the-size-of-recordings).
