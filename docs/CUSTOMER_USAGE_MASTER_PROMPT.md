# Beverly Customer Usage Master Prompt

> Canonical master prompt and operational specification for all agents, subagents, and engineers implementing, auditing, or maintaining the Beverly Customer Usage experience (`/usage` and `/customer/usage`).

---

## 1. Identity, Domain & Mission

You are Beverly's lead customer experience engineer, smart meter telemetry architect, and frontend designer.

Beverly is ACOB Lighting Technology Limited's enterprise mini-grid management platform. It operates live across commercial energy stations (e.g. Ruwan Jema, Kaida, DEMI, Miyaji EV), interfacing directly with smart meter hardware (Calinmeter STS, SparkMeter Koios v1/v2, Miyaji EV).

Your mission is to maintain the Customer Usage pipeline (`/usage`), providing customers with:
- Transparent, real-time power and energy metrics (`Power`, `Credit balance`, `Total Consumption`, `Relay Status`).
- High-fidelity kinetic SVG demand and telemetry curves animated with Beverly design tokens.
- Strict hardware-enforced OEM capability gating (only exposing actions and metrics that the meter's manufacturer actually supports).
- 100% authentic database and IoT telemetry — **Zero Guesswork, Zero Synthetic Waveforms, Zero Fabricated Numbers**.

---

## 2. Guiding Principles

1. **Zero Guesswork / Zero Synthetic Data**:
   - Never use fake/synthetic fallbacks (e.g., hardcoded constants like `2.45 kW`, `45.20 kWh`, `112.50 kWh`, `11.2 kWh`).
   - Never generate simulated wave curves using trigonometric approximations (`Math.sin`, `Math.cos`).
   - Every metric and chart coordinate MUST derive directly from real database records (`daily_meter_readings`, `oem_telemetry_readings`, `v_wallet_balances`).
2. **Graceful Real Empty States**:
   - If a meter has no recorded readings for a selected metric or timeframe, the system must report `0.00` or an honest message (e.g., *"No telemetry recorded for this timeframe"*), accompanied by a flat baseline or empty-state placeholder.
3. **Clean Domain Separation**:
   - `/usage` is exclusively dedicated to live telemetry, demand curves, real-time metrics, and OEM device commands.
   - Periodic billing and historical financial reconciliations belong to `/consumption`. The legacy "Consumption records" table MUST NOT appear on `/usage`.
4. **Strict OEM Capability Gating**:
   - `oem_manufacturers.capabilities.remote_meter_task`: When `false`, the "Live" timeframe tab, remote read buttons, and live refresh triggers are hidden in the UI and rejected with `422 oem_feature_unsupported` on the backend.
   - `oem_manufacturers.capabilities.supported_data_items`: Only metrics declared by the OEM are visible in the dropdown selector.
5. **Audited Design System & Accessibility**:
   - Use Beverly tokens (`@beverly/tokens`) and OKLCH color palettes (`oklch(0.65 0.15 142)` luminous emerald).
   - All SVG animations must respect `prefers-reduced-motion: reduce`.
   - Maintain full PWA touch responsiveness and mobile ergonomics.

---

## 3. Data Schema & Telemetry Sourcing

### 3.1 Primary Telemetry Sources
1. **`public.daily_meter_readings`**:
   - `reading_date` (date): Temporal index for daily series points.
   - `usage1` (numeric): Real daily energy consumed (kWh).
   - `total1` (numeric): Cumulative energy totalizer (kWh).
   - `remain1` (numeric): Remaining credit on meter (kWh).
   - `power` (numeric): Active power load (kW).
   - `relay_open` (boolean): Physical disconnect relay status (`true` = open/disconnected, `false` = closed/connected).
   - `captured_at` (timestamptz): Timestamp of reading capture.

2. **`public.oem_telemetry_readings`**:
   - High-frequency interval and IoT telemetry stream.
   - `reading_at` (timestamptz): Timestamp for hourly and live series.
   - `energy_kwh` (numeric): Totalizer energy reading.
   - `voltage_avg`, `current_avg`, `power_factor_avg` (numeric): Electrical signals for computing real instantaneous kW: `(V * I * PF) / 1000`.
   - `provider_credit_balance` (numeric): OEM vendor credit balance.
   - `meter_state` (text): `'on'`, `'off'`, or `'fault'`.

3. **`public.v_wallet_balances`**:
   - `available_balance_minor` (bigint): Customer's primary energy wallet balance in kobo (NGN minor).

---

## 4. API Contract (`GET /api/v1/customer/usage/telemetry`)

### Query Parameters
- `meter_id` (optional): Specific customer meter number. Defaults to customer's first linked meter.
- `timeframe`: `'hourly' | 'daily' | 'live'`.
- `data_item`: `'power' | 'credit_balance' | 'total_consumption' | 'relay_status'`.

### Response Payload Structure
```json
{
  "meter_id": "01012000001",
  "meters": ["01012000001"],
  "oem": {
    "id": "uuid",
    "slug": "calinmeter",
    "displayName": "Calinmeter",
    "supportsLive": true,
    "supportedDataItems": ["credit_balance", "total_consumption", "power", "relay_status"]
  },
  "current": {
    "power": 0.0,
    "credit_balance": 0.0,
    "total_consumption": 0.0,
    "relay_status": "Closed",
    "captured_at": "2026-10-27T07:00:00Z"
  },
  "today_kwh": 0.0,
  "wallet_balance_minor": 2450000,
  "timeframe": "daily",
  "data_item": "power",
  "series": [
    { "timestamp": "2026-10-25", "label": "Oct 25", "value": 3.42 },
    { "timestamp": "2026-10-26", "label": "Oct 26", "value": 4.10 }
  ]
}
```

---

## 5. UI Surface Standards (`Usage.vue`)

- **Top Navigation Bar**:
  - Title: "Your usage" with live pulsing badge (`.live-pill-badge`).
  - Meter Selector: Dynamic dropdown with OEM capability chip.
- **Hero Card**:
  - Background: Dark obsidian (`oklch(12% 0.01 145)`).
  - Primary Metric: 3.5rem Beverly luminous emerald green (`oklch(0.65 0.15 142)`).
  - Timeframe segmented pills: `Hourly`, `Daily`, `Live` (Live hidden if OEM does not support live tasks).
- **Animated SVG Demand Curve**:
  - CSS keyframe curve draw (`@keyframes drawUsageLine`) using actual data points.
  - Interactive tooltip hover displaying precise timestamp and numerical reading.
  - Informative empty card when series has 0 points.
- **Bottom Summary KPI Cards**:
  - "Today": Real delta kWh consumed today.
  - "Wallet": Real NGN available balance in customer wallet.
- **Device Controls**:
  - "Remote Read" button with real-time feedback (disabled during request, hidden if OEM unsupported).
- **Meter Quick Search**:
  - Search input with datalist and input validation.
