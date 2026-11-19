/**
 * Plain-language insights drawn from the analytics numbers. Each rule states its threshold, says
 * what it saw and why it matters, and stays silent when there is not enough data to say anything.
 * Nothing here estimates or invents: every sentence is worked out from the figures passed in.
 *
 * tone: "good" (going well), "watch" (needs a look), "info" (worth knowing).
 */
import { nairaFromMinor } from "./pue-api.js";

const pct = (share) => `${Math.round(share * 100)}%`;
const pad = (n) => String(n).padStart(2, "0");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Minimum number of finished swaps before a rate means anything. */
const MIN_FINISHED = 10;

/**
 * @param analytics  the /analytics/swaps payload, or null
 * @param fleet      { status, counts: { total, online, offline, lowCharge }, error } from the live store
 */
export function swapInsights(analytics, fleet) {
  const out = [];
  if (!analytics) return out;
  const t = analytics.totals;

  if (t.swaps === 0) {
    out.push({ key: "none", tone: "info", title: "No swaps in this period", detail: "Swaps appear here as soon as the first one is reserved." });
  } else {
    const finished = t.completed + t.cancelled + t.expired;
    if (finished >= MIN_FINISHED && t.completionRate !== null) {
      if (t.completionRate < 0.7) out.push({ key: "completion-low", tone: "watch", title: `Only ${pct(t.completionRate)} of finished swaps ended in a handover`, detail: `${plural(t.cancelled, "swap was", "swaps were")} cancelled and ${plural(t.expired, "expired", "expired")}. Check whether reservations are held too long or riders are not arriving.` });
      else if (t.completionRate >= 0.9) out.push({ key: "completion-high", tone: "good", title: `${pct(t.completionRate)} of finished swaps ended in a handover`, detail: "Reservations are turning into swaps." });
    }
    if (t.expired >= 3) out.push({ key: "expired", tone: "watch", title: `${plural(t.expired, "reservation", "reservations")} expired unused`, detail: "Each one held a charged battery away from other riders." });

    const peak = (analytics.byHour ?? []).reduce((best, h) => (h.completed > best.completed ? h : best), { hour: 0, completed: 0 });
    if (peak.completed >= 3) out.push({ key: "peak", tone: "info", title: `Busiest hour is ${pad(peak.hour)}:00`, detail: `${plural(peak.completed, "handover", "handovers")} in that hour over the period. Have charged batteries ready before it.` });

    const top = analytics.byStation?.[0];
    if (top && analytics.byStation.length > 1 && t.completed >= MIN_FINISHED) {
      const share = top.completed / t.completed;
      if (share >= 0.6) out.push({ key: "station-share", tone: "info", title: `${top.name} handles ${pct(share)} of swaps`, detail: "Demand is concentrated there; the other stations have room." });
    }

    const money = (analytics.byMethod ?? []).reduce((sum, m) => sum + m.amountMinor, 0);
    const cash = analytics.byMethod?.find((m) => m.method === "cash");
    if (cash && money > 0 && cash.amountMinor / money >= 0.7 && t.completed >= MIN_FINISHED) out.push({ key: "cash", tone: "info", title: `${pct(cash.amountMinor / money)} of money is taken as cash`, detail: "Cash needs counting and banking; transfer, POS and Paystack reconcile themselves." });

    if (t.refundsMinor > 0) out.push({ key: "refunds", tone: "watch", title: `${nairaFromMinor(t.refundsMinor)} owed back to riders`, detail: "Finance pays these out; each is on a cancelled swap that had been paid." });
    if (t.medianMinutesToHandover !== null && t.completed >= MIN_FINISHED && t.medianMinutesToHandover > 60) out.push({ key: "slow", tone: "watch", title: `Half of handovers take over ${t.medianMinutesToHandover} minutes`, detail: "That is the time from reservation to the battery changing hands." });
    if (t.repeatRiderShare !== null && t.activeRiders >= 5) {
      if (t.repeatRiderShare >= 0.5) out.push({ key: "repeat-high", tone: "good", title: `${pct(t.repeatRiderShare)} of riders swapped more than once`, detail: "Riders are coming back." });
      else if (t.repeatRiderShare < 0.2) out.push({ key: "repeat-low", tone: "watch", title: `Only ${pct(t.repeatRiderShare)} of riders swapped more than once`, detail: "Most riders swapped once in this period." });
    }
  }

  // Live battery data (Yunhe). Charge and location insights need it, and say so when it is not there.
  if (fleet?.status === "unavailable") {
    out.push({ key: "fleet-off", tone: "info", title: "Live battery data is not connected", detail: "Charge, location and online insights appear here once the Yunhe platform answers." });
  } else if (fleet?.status === "ok") {
    if (fleet.counts.lowCharge > 0) out.push({ key: "low-charge", tone: "watch", title: `${plural(fleet.counts.lowCharge, "battery is", "batteries are")} low on charge`, detail: "Charge them before they are offered for a swap." });
    if (fleet.counts.offline > 0) out.push({ key: "offline", tone: "watch", title: `${plural(fleet.counts.offline, "battery is", "batteries are")} offline`, detail: "No recent signal from the platform; check the tracker or the network." });
    if (fleet.counts.total > 0 && fleet.counts.lowCharge === 0 && fleet.counts.offline === 0) out.push({ key: "fleet-ok", tone: "good", title: "Every tracked battery is online and charged", detail: `${plural(fleet.counts.total, "battery", "batteries")} reporting.` });
  }
  return out;
}

/** @param analytics the /analytics/appliances payload, or null */
export function applianceInsights(analytics) {
  const out = [];
  if (!analytics) return out;
  const t = analytics.totals;

  if (t.unitsTotal === 0) {
    out.push({ key: "no-units", tone: "info", title: "No appliance units registered yet", detail: "Add what you sell to the catalogue, then register each unit by serial number." });
    return out;
  }
  if (t.activeSales > 0 && t.paidShare !== null) {
    if (t.paidShare < 0.4) out.push({ key: "owed-low-paid", tone: "watch", title: `${nairaFromMinor(t.outstandingMinor)} is still owed, with only ${pct(t.paidShare)} paid`, detail: `Across ${plural(t.activeSales, "active sale", "active sales")}. Follow up on instalments.` });
    else out.push({ key: "owed", tone: "info", title: `${nairaFromMinor(t.outstandingMinor)} is still owed`, detail: `${pct(t.paidShare)} of the value of ${plural(t.activeSales, "active sale", "active sales")} is paid.` });
  }
  if (t.soldInWindow === 0 && (analytics.unitsByStatus?.in_stock ?? 0) > 0) out.push({ key: "no-sales", tone: "info", title: "No appliance sold in this period", detail: `${plural(analytics.unitsByStatus.in_stock, "unit is", "units are")} in stock.` });
  if (t.soldInWindow > 0 && (analytics.unitsByStatus?.in_stock ?? 0) === 0) out.push({ key: "sold-out", tone: "watch", title: "Nothing left in stock", detail: "Every unit is sold, faulty or retired. Register new units to keep selling." });
  const high = analytics.openFaultsBySeverity?.high ?? 0;
  if (high > 0) out.push({ key: "faults-high", tone: "watch", title: `${plural(high, "high-severity fault is", "high-severity faults are")} open`, detail: "Start with these." });
  else if (t.openFaults > 0) out.push({ key: "faults-open", tone: "info", title: `${plural(t.openFaults, "fault is", "faults are")} open`, detail: "None is high severity." });
  if (t.medianHoursToResolve !== null) out.push({ key: "fix-time", tone: t.medianHoursToResolve > 72 ? "watch" : "good", title: `Faults take ${t.medianHoursToResolve} hours to fix (median)`, detail: t.medianHoursToResolve > 72 ? "More than three days; customers are waiting." : "Repairs are keeping pace." });
  const faultyUnits = analytics.unitsByStatus?.faulty ?? 0;
  if (faultyUnits > 0 && t.unitsTotal >= 5 && faultyUnits / t.unitsTotal >= 0.2) out.push({ key: "faulty-share", tone: "watch", title: `${pct(faultyUnits / t.unitsTotal)} of units are marked faulty`, detail: "Check whether one model or supplier is causing it." });
  return out;
}
