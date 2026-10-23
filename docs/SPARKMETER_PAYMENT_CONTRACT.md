# SparkMeter payments through Beverly wallets

Status: specifications partly verified; dispatch unimplemented.
Verified date: 2026-10-23.

## Authoritative evidence

Source: authenticated official Koios documentation.
URL: https://www.sparkmeter.cloud/docs/api/
Select `Koios API v1`.
Operations: `makeCustomerPayment`, `getPaymentByExternalId`, `reverseCustomerPayment`.
Support reference: ticket CH-82160, October 21.

The current documentation was inspected directly.
No payment request was executed.
Older ThunderCloud API documents differ.
Their guarantees cannot certify Koios behavior.

## Verified provider operations

| Operation | Verified contract |
| --- | --- |
| Authentication | `X-API-KEY` and `X-API-SECRET` |
| Customer payment | `POST /api/v1/customers/{customer_id}/payments` |
| Request | Decimal-string `amount`, `memo`, `external_id` |
| Reference scope | Unique within the organization |
| Payment source | Token-associated vendor sales account |
| Write scope | Full access |
| Lookup | `GET /api/v1/payments?external_id=<command-id>` |
| Lookup scope | Monitoring |
| Creation success | HTTP 201, payment envelope |
| Lookup success | HTTP 200, payment envelope |
| Payment evidence | `id`, `recipient_id`, `amount.value`, `amount.currency`, `external_id`, `status` |
| Processed example | `status="processed"` |
| Reversal | `POST /api/v1/payments/{payment_id}/reverse` |

The request schema describes organization-wide uniqueness.
It does not document duplicate-response timing.
The 429 example mentions 500 requests/minute.
Support still queries actual write limits.
An example is not production capacity certification.

Reversal removes the customer's credited amount.
Its example has a negative amount.
It is a separate financial mutation.
It cannot prove harmless test cleanup.
No automatic reversal is authorized here.

## Beverly-owned wallet workflow

1. Fund the existing Beverly wallet.
2. Authenticate the customer or vendor.
3. Enforce PIN and existing wallet controls.
4. Resolve the tenant-owned installation mapping.
5. Verify the assigned customer and meter.
6. Create the durable purchase command.
7. Reserve the trusted NGN amount.
8. Record dispatch intent before network transmission.
9. Submit exactly one provider payment.
10. Match provider evidence before capture.
11. Capture the existing hold idempotently.
12. Publish the receipt and audit event.

Paystack funding remains a separate flow.
SparkMeter never directly funds Beverly wallets.
The Beverly ledger remains financial truth.
SparkMeter receives electricity credit instructions only.
No synthetic token is generated.
Physical delivery must have separate evidence.
Provider processing does not prove meter receipt.

The command reference must remain immutable.
Reuse Beverly's durable command identifier.
Never create another reference during recovery.
Never infer ownership from customer names.
Meterless customers remain ineligible for payment.

## Payment evidence and recovery

| Evidence | Beverly action |
| --- | --- |
| Exact processed payment | Capture the original hold once |
| Timeout or dropped connection | Retain hold; lookup original reference |
| Duplicate-reference response | Retain hold; lookup original reference |
| Lookup HTTP 404 | Keep unresolved; never resubmit automatically |
| Lookup amount/customer/currency mismatch | Retain hold; require operator review |
| Unknown provider status | Retain hold; require operator review |
| HTTP 429 or server error | Never retry the payment automatically |
| Documented validation rejection | Record rejection; orchestrator controls hold release |
| Confirmed provider reversal | Require separately audited ledger compensation |

Read-only lookup can use bounded backoff.
Its exhausted budget means manual review.
A missing payment is not failure proof.
Delayed visibility remains undocumented by SparkMeter.
Never release an ambiguous financial hold automatically.
No duplicate POST is needed for reconciliation.

The adapter validates exact expected evidence.
Required matches include recipient, amount, and currency.
It also matches the immutable external reference.
A valid provider payment UUID is required.
Decimal evidence is compared using integer arithmetic.
Unexpected errors cannot confirm payment success.

## Outstanding execution requirements

- Integrate durable dispatch and hold recovery.
- Prove crash recovery around network transmission.
- Add shared provider-write concurrency controls.
- Implement authenticated read-only payment lookup.
- Verify isolation with deployed database grants.
- Verify receipts distinguish processing from delivery.
- Complete the provider-recommended restricted test setup.
- Verify the NGN 100 canary separately.
- Resolve GitHub release access and production migration.

Single-attempt dispatch avoids automatic-retry assumptions.
It does not establish provider timing guarantees.
Duplicate-write semantics remain a retry-specific gap.
Provider write-rate scope still requires confirmation.
Keep payment dispatch disabled pending implementation verification.

## Verification limits

Adapter tests use verified-schema synthetic fixtures.
They do not prove live financial settlement.
No provider payment or reversal was sent.
No production configuration was changed.
No full wallet integration is claimed.
