# SparkMeter support guidance: CH-82160

Source: correspondence supplied by the user from SparkMeter support, signed Aniekan Akpan. The correspondence date was not supplied. The following captures the provider's guidance; it is not evidence that Beverly's production integration has passed provider testing.

## Ticket context

Support reopened the ticket after initially closing it. The message explained that the original request used `frostgraphix123@gmail.com`, had no copied ACOB contact, and lacked a named contact or phone number in the signature. Support contacted Tansi, who initially indicated that the ticket could be closed. Support then proceeded following the reopening request and confirmation.

## Test environment

SparkMeter does not offer dedicated test organizations. Support recommends creating a test site inside the existing organization, with a test meter and a test sales account. After testing, contact SparkMeter to rename or archive the test site.

This guidance does not create a test site, authorize a payment, or establish that a test account has been provisioned.

## Payments and duplicate prevention

Support recommends a unique `external_id` on every payment. The API enforces uniqueness: retrying an existing `external_id` returns HTTP 400, preventing another transaction with that identifier.

After a timeout or uncertain result, check the original payment before retrying:

```http
GET https://www.sparkmeter.cloud/api/v1/payments?external_id={external_id}
```

Without `external_id`, each payment is processed as a new transaction; duplicates cannot be automatically detected. Support says to verify the result before retrying. If its payment ID is known, query:

```http
GET https://www.sparkmeter.cloud/api/v1/payments/{payment_id}
```

Support says an accidental duplicate can be reversed:

```http
POST https://www.sparkmeter.cloud/api/v1/payments/{payment_id}/reverse
```

Reversal is a separate financial action. This correspondence does not authorize automatic reversals or establish their effect on Beverly's ledger.

## Rate limits

Consult SparkMeter's current [API FAQ](https://get.support.sparkmeter.io/servicedesk/customer/portal/4/article/3240361985?source=search). Support did not provide a fixed rate. On HTTP 429, delay before retrying and space batch writes. Treat provider limits and applicable headers as changeable.

## Beverly implementation

- Use the durable command ID as `external_id`.
- Never automatically repeat an uncertain payment POST. Query the same reference instead.
- A duplicate HTTP 400 triggers lookup; it does not independently prove success or failure.
- Keep ambiguous payments unresolved. A lookup 404 does not establish that payment is absent.
- Match reference, recipient, amount, currency, payment ID and processed status before confirming provider payment. Physical meter delivery needs separate evidence.
- Respect `Retry-After` when present. If the delay exceeds the immediate retry budget, defer reconciliation.
- Use the provider-recommended test site, meter and sales account only after they are actually provisioned.

See [payment contract](SPARKMETER_PAYMENT_CONTRACT.md) and [Koios v2 contract](SPARKMETER_KOIOS_V2_VERIFIED_CONTRACT.md) for the existing integration boundaries.
