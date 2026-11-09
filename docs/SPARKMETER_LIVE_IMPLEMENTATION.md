# SparkMeter live implementation

Evidence captured on 4 November 2026.

## Verified production evidence

- Koios listed the Adebayo Nova site with 309 customers. Its listed meters included readings approximately 13 hours old. Its Nova page showed a recent cloud connection. A cloud connection does not certify a recent meter reading.
- Beverly production held 307 active imported meters for that site, last observed on 6 October. The counts describe different records and cannot by themselves establish which customers need reconciliation.
- The production telemetry table had zero readings. One historical telemetry checkpoint existed, covering 24 October, updated 25 October. This does not prove the provider had no readings or that later jobs succeeded.
- Production deployment was main commit `2c2160ceb4d78f6c18e0415449af1d2c51dd86d1`. Local changes were not included.

## Implemented locally

- The authenticated telemetry synchronization path can request the documented live endpoint with a one-hour age window. Pages use the existing ownership-checked persistence boundary and bounded retry, pacing and pagination. The normal scheduled historical path remains unchanged.
- SparkMeter adapter operations reject cross-installation requests. Payment recovery reads the installation-scoped `canonical_request` column, confirmed against the production database schema.
- Suspended installations cannot bypass vending checks by matching a hard-coded ID. Provider connection checks validate the customer response envelope.
- Site enumeration traverses inventory pages and exposes station pagination. Its site names remain provider identifiers, not verified display names.
- Meter lookup verifies the customer, site and meter against Koios before marking SparkMeter inventory live. Transport failures can fall back to stored inventory, which is not marked live.
- The direct-credit path checks ownership again before payment. It sends one payment request using the command ID as the external ID, then uses read-only lookup for uncertain outcomes. Unconfirmed outcomes retain the wallet hold for review.
- Connection probes reject redirects so custom API credential headers cannot be forwarded to an unapproved destination. Meter and customer identifier lookups fail closed when inventory matches are ambiguous across installations.
- Customer and vendor previews do not claim calculated energy, tax or delivery when those values have not been confirmed by Koios. An authorized staff endpoint exposes a filtered live customer snapshot; CRM screens are not yet connected to it.

## Remaining release work

- Verify authenticated Koios live responses with the configured production credentials. No direct live response was obtained in this session.
- Verify a one-site synchronization against current production data, ownership checks, pagination and replay. Do not infer success from an empty response.
- Connect authorized CRM views to verified inventory and telemetry. Several SparkMeter views intentionally return unavailable until this is done.
- Reconcile fresh provider inventory, tariff semantics, payment confirmation and customer displays. Koios showed an Adebayo residential tariff of NGN 400/kWh; Beverly's generic fallback uses NGN 350/kWh. Do not represent calculated units as provider-confirmed.
- Run complete build and regression checks, review the combined worktree, then deploy and verify production. Financial outcomes and physical meter delivery need independent evidence.

## Follow-up on 5 November 2026

- A read-only production database query reported 3,074 active inventory meters and zero telemetry readings. These totals alone do not prove the upstream state.
- The Wallet Admin session expired before the provider connection probe could be run. The Koios portfolio page displayed no service areas or customers during this check; this does not establish that the organization has none.
- The provider's recommended test site and sales account have not been identified. No payment was submitted.

## Follow-up test-site selection

- Koios lists the service area and site `NOVA 205 TEST`. The site showed zero customers and no grid monitors or tariffs; its last cloud connection was 807 days ago. Its technical page showed a Nova with four queued messages and a power-loss event 1,251 days ago. It is not yet a usable end-to-end vending fixture. No customer meter or test sales account was identified there.
- Production Wallet Admin displays the two SparkMeter installations as Calinmeter because its frontend infers adapter and URL from the display name. The scoped installations API does not return either field. Its connection test also substitutes inventory reconciliation when the provider probe endpoint is absent; that response does not establish provider connectivity.
- A read-only inventory query found 3,074 active meters, all with customer identifiers. Searching imported customer names and codes for “test” found one ordinary customer name containing that substring, not evidence of a test meter. These checks do not establish whether a physical spare exists outside the imported inventory.
- Locally, the console no longer fabricates provider details or treats reconciliation as a successful probe. An installation-grant-protected SparkMeter connection endpoint performs a read-only Koios probe and returns only its success state. This endpoint and the corrected console have not been deployed or tested against production credentials.

## Read-only comparison, 7 November 2026

- Koios customer `88c8ffaa-d98f-4ea4-adb7-7cb44c4390e2` is associated with meter `SMRSD-04-0001D31C` at Oloyan. Koios showed the meter on, a reading about 11 hours and 51 minutes old, and a payment on 27 October 2026. Its prior inactivity cannot be established; it is a customer-assigned meter, not a verified spare.
- A read-only production inventory lookup returned that same customer and meter relationship, marked active, with inventory last seen 6 October 2026. This checks the stored mapping only; it does not verify an authenticated Beverly-to-Koios API request, payment posting, or credit delivery.

## Production schema check

- Production `purchase_orders.oem_id` is a UUID foreign key to `oem_manufacturers`. The meter lookup returned the string `sparkmeter`; the dispatcher previously attempted to insert that string. The local direct-credit dispatcher now uses the installation's manufacturer UUID and rejects ambiguous meter matches. A regression test exercises the slug-to-UUID case.
- Production permits null for direct-credit order units, energy value, VAT fields, and meter type. This confirms column nullability only; provider posting and settlement remain unverified.
- Production `oem_commands` stores the hold ID inside `canonical_request`; it has no `wallet_hold_id`, `response_payload`, `response_received_at`, or `error_message` columns. Local recovery now reads the JSON hold ID, uses existing normalized error columns, limits payment reconciliation to SparkMeter payment commands, and leaves a command unresolved if wallet capture fails. A submission-state write error now stops dispatch before the provider call.
- When provider evidence confirms a payment whose hold is already released or expired, local recovery creates an operational exception and marks the command for manual review. It does not automatically debit the wallet again.

## Production payment review, 7 November 2026

- Read-only production data shows five SparkMeter payment commands in `unknown` state, each for NGN 50, created on 25 October 2026. Their orders are pending review and all five wallet holds are released. Provider payment outcomes remain unverified; no loss or payment success is inferred.
- Original command references: `597d672f-2dea-48d2-a72c-76676df86fd1`, `933536cc-3ee9-4aff-9d56-763a3228979a`, `17c0ad3c-7d8a-41d2-8941-8cad85632676`, `b8000988-e637-438f-b876-34ef6af5aab1`, and `453de31c-603c-4a56-b319-f53ffdf64b4b`. Reconcile each against Koios using its original external ID before any corrective ledger action or retry.
- Two additional production SparkMeter commands are recorded as succeeded with captured holds. These database records alone do not independently verify the provider or physical meter.
- All five unknown commands name the same Koios customer. That customer's Koios payment history shows eight NGN 50 system payments approximately 12 days old. The visible list does not expose the external IDs or precise timestamps, so those rows cannot be matched conclusively to the five unknown commands. No financial action was taken.

## Non-destructive release audit

- The release worktree contains changes beyond the SparkMeter wallet path, including CRM dashboard and station onboarding work. Production and remote main were both at `2c2160ce` when checked.
- The `sparkmeter-unverified-safety` checks passed. The separate legacy `oem-grid-control` test failed at its first assertion: it expects HTTP 200 and simulated relay data, while the current SparkMeter boundary deliberately returns HTTP 503 until provider control is verified. No relay write was reached.
- The configured telemetry cron runs daily. The new live mode is not scheduled, and no authenticated Koios-to-Beverly live response has been verified. Zero stored readings and five unknown payment commands remain visible in production.
- The deployed Beverly project and remote `main` both resolved to commit `2c2160ceb4d78f6c18e0415449af1d2c51dd86d1`. The local source changes were not part of that deployment. No production deployment, relay command, payment, or reconciliation mutation was performed during this audit.
- Recovery now filters for payment operations before applying its page limit, so unrelated command types cannot consume that page. SparkMeter manufacturer verification still applies before processing each row.
- The complete project build and root test command passed. The wallet suite passed all 858 tests with two workers after its default-concurrency run timed out in an unrelated customer-email test. The separate legacy grid-control test still fails as described above.

## Subsequent local changes

- Historical telemetry can resume an incomplete stored checkpoint. Provider cursor expiry and concurrent runs remain unverified.
- The legacy grid-control test was updated to check explicit unavailability instead of fabricated relay success; it now passes locally. This does not verify actual relay controls.
- SparkMeter CRM telemetry and relay screens no longer display the identified fabricated values when their data sources are unavailable. Live CRM data remains unconnected.
- No production changes or financial transactions were performed during this follow-up.

## Provider tariff contract

Authenticated Koios v1 documentation exposes `GET /api/v1/tariffs/{tariff_id}`. The documented response can include `electricity_rate.value`, `electricity_rate.unit`, `electricity_rate_type`, time-of-use rules, block rates and plan information. The documentation example is not a live tariff. A displayed flat rate alone does not establish how taxes, credits, plans or physical delivery should be calculated. The API requires both `X-API-KEY` and `X-API-SECRET`.

Source: https://www.sparkmeter.cloud/docs/api/?urls.primaryName=Koios%20API%20v1#/Tariffs/get_tariffs__tariff_id_

## Local follow-up, 8 November 2026

- The read-only telemetry probe is registered locally for granted super-admins and checks an active installation and inventory site before contacting Koios. Its tests use mocked provider responses; they do not establish live connectivity. Station-scoped access remains unavailable pending verified site-level authorization.
- The CRM stored-readings boundary and its fixture pass locally. The power-quality page has an initial stored-readings view, but the broader CRM integration and actual live readings are not verified.
- A read-only payment verification endpoint has local tests. The five uncertain payments have not been matched to authenticated Koios responses; no payment or ledger change was made.
- The telemetry probe, CRM work, and payment verification remain undeployed and incomplete as production solutions.
