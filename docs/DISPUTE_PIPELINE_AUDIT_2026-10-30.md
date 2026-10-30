# Dispute pipeline audit — 30 October 2026

## Evidence

- The production dispute list displayed DISP-2026-00006 on the preceding verification. Its modal displayed a customer, but no linked meter or purchase amount. A meter-like subject alone does not establish a purchase link. The current production session expired before this audit could inspect the record further.
- `backend/wallet/src/services/disputes.ts` obtains meter and payment context only from `purchase_order_id`.
- Customer purchase orders identify their wallet owner by `actor_type` and `actor_id`. The customer receipts list and receipt access previously compared the wallet customer ID with the provider-facing `customer_id` instead.
- Customer dispute detail receives `dispute_messages`, while the customer screen previously rendered `messages`.
- Customer evidence was signed for customers, but staff detail did not sign or display it. A failed attachment update was not checked. The customer screen promised later attachment upload without offering it.
- Vendor dispute detail and replies previously lacked organization checks. Missing organization context could produce an unfiltered list. Creation returned a nested ID object and accepted an arbitrary purchase ID. Customer creation also accepted an arbitrary purchase ID.
- Staff updates could combine status and message writes without atomicity. The refund-issued status did not verify a linked approved refund. Refund approval records store the credit ledger entry.

## Changes

- Restrict customer and vendor purchase associations to their purchasing actor. Restrict vendor cases to the authenticated organization.
- Correct receipt ownership checks and vendor creation response.
- Show the customer conversation and allow later attachment uploads. Show attachments to staff using signed URLs. Surface evidence update and receipt loading failures.
- Separate status changes from replies. Require a linked approved refund with a ledger entry before marking a dispute refund-issued. This check does not issue a refund or establish that a partial refund covers the full purchase.
- Explicitly distinguish an unlinked purchase from an unavailable linked purchase. No meter is inferred from a subject.

## Verification and limits

- Local builds, targeted API tests, simulated browser flows, and repository test suites were executed. Tests use synthetic records.
- No production dispute, attachment, refund, or message was changed during this audit. Live customer and vendor journeys remain unverified. At audit time, the new changes remained local.
- Staff replies now trigger customer dispute notifications with case links and a message-specific deduplication key. Delivery follows the existing preference-aware notification service and remains best effort; failures are logged, and no transactional outbox guarantees delivery. Attachment activation uses conditional updates and retries to prevent lost concurrent changes, while retaining the five-file limit. Concurrent-update behavior is tested using simulated storage; production database behavior has not been tested.
