/**
 * Describes each PUE registry screen: its columns, its form fields, and which
 * other registries it looks up. RegistryPage.vue renders any of these.
 *
 * Row keys are snake_case (what the API returns). Field keys are camelCase
 * (what the API accepts); `row` names the matching snake_case key for editing.
 */

const STATUS3 = [["planned", "Planned"], ["active", "Active"], ["inactive", "Inactive"]];

export const RESOURCES = {
  sites: {
    title: "Sites",
    singular: "site",
    blurb: "Communities where PUE runs, grouped by state.",
    columns: [
      { key: "name", label: "Site" },
      { key: "state", label: "State" },
      { key: "community", label: "Community" },
      { key: "status", label: "Status", badge: true }
    ],
    fields: [
      { key: "name", row: "name", label: "Site name", type: "text", required: true },
      { key: "state", row: "state", label: "State", type: "text", required: true },
      { key: "community", row: "community", label: "Community", type: "text" },
      { key: "beverlyStationId", row: "beverly_station_id", label: "Beverly station ID", type: "text", help: "For example MUSHA. Leave empty if the site is not on a mini-grid." },
      { key: "address", row: "address", label: "Address", type: "text" },
      { key: "status", row: "status", label: "Status", type: "select", options: STATUS3, default: "planned" }
    ]
  },
  "swap-stations": {
    title: "Swap stations",
    singular: "swap station",
    blurb: "Stations where riders swap batteries.",
    columns: [
      { key: "name", label: "Station" },
      { key: "site_id", label: "Site", lookup: "sites" },
      { key: "handover_mode", label: "Handover", map: { attendant: "Attendant", cabinet: "Cabinet" } },
      { key: "bay_count", label: "Bays" },
      { key: "status", label: "Status", badge: true }
    ],
    fields: [
      { key: "siteId", row: "site_id", label: "Site", type: "select", lookup: "sites", required: true },
      { key: "name", row: "name", label: "Station name", type: "text", required: true },
      { key: "handoverMode", row: "handover_mode", label: "Handover", type: "select", options: [["attendant", "Attendant checks receipt"], ["cabinet", "Cabinet releases the bay"]], default: "attendant" },
      { key: "bayCount", row: "bay_count", label: "Number of bays", type: "number" },
      { key: "yunheStationId", row: "yunhe_station_id", label: "Yunhe station ID", type: "text" },
      { key: "status", row: "status", label: "Status", type: "select", options: STATUS3, default: "planned" }
    ]
  },
  bikes: {
    title: "Bikes",
    singular: "bike",
    blurb: "Every bike, with its serial number and sale status.",
    columns: [
      { key: "serial_number", label: "Serial number" },
      { key: "model", label: "Model" },
      { key: "status", label: "Status", badge: true },
      { key: "site_id", label: "Stocked at", lookup: "sites" }
    ],
    fields: [
      { key: "serialNumber", row: "serial_number", label: "Serial number", type: "text", required: true },
      { key: "model", row: "model", label: "Model", type: "text" },
      { key: "status", row: "status", label: "Status", type: "select", options: [["in_stock", "In stock"], ["sold", "Sold"], ["repossessed", "Repossessed"], ["retired", "Retired"]], default: "in_stock" },
      { key: "siteId", row: "site_id", label: "Stocked at", type: "select", lookup: "sites" }
    ]
  },
  batteries: {
    title: "Batteries",
    singular: "battery",
    blurb: "Every battery by its Yunhe battery number. Live charge and cell readings are on Diagnostics.",
    columns: [
      { key: "battery_number", label: "Battery number" },
      { key: "serial_number", label: "Serial number" },
      { key: "cell_count", label: "Cells" },
      { key: "status", label: "Status", badge: true },
      { key: "station_id", label: "Station", lookup: "swap-stations" }
    ],
    fields: [
      { key: "batteryNumber", row: "battery_number", label: "Battery number", type: "text", required: true, help: "The BT… number shown on the Yunhe platform." },
      { key: "serialNumber", row: "serial_number", label: "Serial number", type: "text" },
      { key: "imsi", row: "imsi", label: "IMSI", type: "text" },
      { key: "cellCount", row: "cell_count", label: "Number of cells", type: "number", help: "Leave empty until confirmed on the platform." },
      { key: "status", row: "status", label: "Status", type: "select", options: [["in_stock", "In stock"], ["in_bay", "In a bay"], ["with_rider", "With a rider"], ["maintenance", "Maintenance"], ["lost", "Lost"], ["retired", "Retired"]], default: "in_stock" },
      { key: "stationId", row: "station_id", label: "Station", type: "select", lookup: "swap-stations" }
    ]
  },
  riders: {
    title: "Riders",
    singular: "rider",
    blurb: "People who buy bikes and swap batteries. This is the PUE customer register; it does not need a meter.",
    columns: [
      { key: "full_name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "site_id", label: "Site", lookup: "sites" },
      { key: "status", label: "Status", badge: true }
    ],
    fields: [
      { key: "fullName", row: "full_name", label: "Full name", type: "text", required: true },
      { key: "phone", row: "phone", label: "Phone", type: "tel", required: true, help: "For example 0803 290 2825." },
      { key: "email", row: "email", label: "Email", type: "email" },
      { key: "address", row: "address", label: "Address", type: "text" },
      { key: "siteId", row: "site_id", label: "Site", type: "select", lookup: "sites" },
      { key: "status", row: "status", label: "Status", type: "select", options: [["active", "Active"], ["suspended", "Suspended"], ["closed", "Closed"]], default: "active" },
      { key: "notes", row: "notes", label: "Notes", type: "text" }
    ]
  }
};

export const RESOURCE_KEYS = Object.keys(RESOURCES);

/** Label for a lookup column or select: the name of the referenced record. */
export function recordLabel(resource, record) {
  if (!record) return "—";
  switch (resource) {
    case "sites": return record.community ? `${record.name} (${record.community}, ${record.state})` : `${record.name} (${record.state})`;
    case "swap-stations": return record.name;
    case "bikes": return record.serial_number;
    case "batteries": return record.battery_number;
    case "riders": return `${record.full_name} (${record.phone})`;
    default: return record.id;
  }
}

/** Form values for a new record, or the existing row. Empty strings become null for the API. */
export function initialForm(config, row) {
  const form = {};
  for (const field of config.fields) {
    const current = row ? row[field.row] : undefined;
    form[field.key] = current ?? (field.default ?? "");
  }
  return form;
}

/** Turns form values into an API body: trims text, numbers become numbers, empty optional values become null. */
export function formToBody(config, form, { editing }) {
  const body = {};
  for (const field of config.fields) {
    const raw = form[field.key];
    const empty = raw === "" || raw === null || raw === undefined;
    if (empty) {
      if (!field.required && editing) body[field.key] = null;
      continue;
    }
    body[field.key] = field.type === "number" ? Number(raw) : typeof raw === "string" ? raw.trim() : raw;
  }
  return body;
}

/** Problems a person can fix before sending. Empty list means the form is ready. */
export function validateForm(config, form) {
  const problems = [];
  for (const field of config.fields) {
    const raw = form[field.key];
    const empty = raw === "" || raw === null || raw === undefined;
    if (field.required && (empty || (typeof raw === "string" && !raw.trim()))) problems.push(`${field.label} is required.`);
    if (!empty && field.type === "number" && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) problems.push(`${field.label} must be a whole number.`);
  }
  return problems;
}
