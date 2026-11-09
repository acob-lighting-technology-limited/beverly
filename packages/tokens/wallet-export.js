const DANGEROUS_FORMULA = /^[\t\r ]*[=+\-@]/;

export function sanitizeSpreadsheetValue(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return DANGEROUS_FORMULA.test(text) ? `'${text}` : text;
}

function csvEscape(value) {
    const text = sanitizeSpreadsheetValue(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function isMoneyColumn(column, sampleRows = []) {
    if (column.aggregate === 'sum' || column.isMoney === true) return true;
    if (column.aggregate === 'none' || column.isMoney === false) return false;
    const header = String(column.header || '');
    const key = String(column.key || '');
    const hasCurrencySymbol = /[₦]|NGN|naira/i.test(header) || /_naira/i.test(key);
    const isNonMoney = /\b(kwh|units|reading|count|rate|percent|percentage|id|date|when|phone|meter)\b/i.test(header)
        || /(kwh|units|reading|count|rate|percent|percentage|id|date|when|phone|meter)/i.test(key);
    if (isNonMoney && !hasCurrencySymbol) return false;
    const isMoneyName = hasCurrencySymbol
        || /\b(amount|gross|net|fee|fees|vat|balance|holds|available|paid|refund|credit|debit|payment|spent|value)\b/i.test(header)
        || /^(amount|gross|net|fee|fees|vat|balance|holds|available|paid|refund|credit|debit)/i.test(key);
    if (!isMoneyName) return false;
    if (sampleRows && sampleRows.length > 0) {
        for (const row of sampleRows) {
            const raw = column.value(row);
            if (raw === null || raw === undefined || raw === '' || raw === '—' || raw === '-') continue;
            const clean = String(raw).replace(/[^0-9.-]/g, '');
            if (clean === '' || !Number.isFinite(parseFloat(clean))) return false;
        }
    }
    return true;
}

export function parseMoneyNumber(raw) {
    if (raw === null || raw === undefined || raw === '' || raw === '—' || raw === '-') return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    let text = String(raw).trim();
    const isParenNegative = /^\(.*\)$/.test(text);
    text = text.replace(/[^0-9.-]/g, '');
    let parsed = parseFloat(text);
    if (!Number.isFinite(parsed)) return 0;
    if (isParenNegative && parsed > 0) parsed = -parsed;
    return parsed;
}

export function formatMoneyTotal(sum, sampleValue) {
    const s = String(sampleValue ?? '');
    if (s.includes('₦')) {
        const absVal = Math.abs(sum);
        const formatted = absVal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return sum < 0 ? `-₦${formatted}` : `₦${formatted}`;
    }
    if (/^NGN\b/i.test(s.trim())) {
        return `NGN ${sum.toFixed(2)}`;
    }
    return sum.toFixed(2);
}

export function rowsToCsv(rows, columns, options = {}) {
    const includeTotals = typeof options === 'boolean' ? options : Boolean(options?.includeTotals);
    const header = columns.map((column) => csvEscape(column.header)).join(',');
    const body = rows.map((row) => columns.map((column) => csvEscape(column.value(row))).join(','));

    if (includeTotals && rows.length > 0) {
        const moneyColIndices = new Set();
        columns.forEach((column, index) => {
            if (isMoneyColumn(column, rows)) moneyColIndices.add(index);
        });

        if (moneyColIndices.size > 0) {
            let labelIndex = columns.findIndex((_, index) => !moneyColIndices.has(index));
            if (labelIndex === -1) labelIndex = 0;

            const totalCells = columns.map((column, index) => {
                if (moneyColIndices.has(index)) {
                    let sum = 0;
                    let firstSample = null;
                    for (const row of rows) {
                        const val = column.value(row);
                        if (firstSample === null && val !== null && val !== undefined && val !== '') {
                            firstSample = val;
                        }
                        sum += parseMoneyNumber(val);
                    }
                    return csvEscape(formatMoneyTotal(sum, firstSample));
                }
                if (index === labelIndex) {
                    return csvEscape('Total');
                }
                return '';
            });

            body.push(totalCells.join(','));
        }
    }

    return [header, ...body].join('\r\n');
}

export function exportTimestamp(date = new Date()) {
    return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function downloadBlob(blob, filename) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
        throw new Error('Downloads require a browser.');
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(filenameBase, rows, columns, options = {}) {
    if (!rows.length) throw new Error('No records available.');
    const csv = rowsToCsv(rows, columns, options);
    downloadBlob(
        new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
        `${filenameBase}-${exportTimestamp()}.csv`,
    );
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
    return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function uint32(value) {
    return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concatBytes(parts) {
    const size = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
}

// ZIP "store" mode avoids a dependency while producing standards-compatible archives.
function buildZip(files) {
    const encoder = new TextEncoder();
    const local = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
        const name = encoder.encode(file.name);
        const data = encoder.encode(file.text);
        const crc = crc32(data);
        const header = concatBytes([
            uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
            uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), name,
        ]);
        local.push(header, data);
        central.push(concatBytes([
            uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
            uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), uint16(0),
            uint16(0), uint16(0), uint32(0), uint32(offset), name,
        ]));
        offset += header.length + data.length;
    }
    const centralBytes = concatBytes(central);
    return concatBytes([...local, centralBytes, concatBytes([
        uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
        uint32(centralBytes.length), uint32(offset), uint16(0),
    ])]);
}

export function buildDailyCsvZip(filenameBase, rows, columns, dateValue, options = {}) {
    if (!rows.length) throw new Error('No records available.');
    const grouped = new Map();
    for (const row of rows) {
        const raw = dateValue(row);
        const parsed = raw ? new Date(raw) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) throw new Error('Daily exports require a valid date for every record.');
        const day = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        const bucket = grouped.get(day) ?? [];
        bucket.push(row);
        grouped.set(day, bucket);
    }
    const files = [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, records]) => ({ name: `${filenameBase}-${day}.csv`, text: '\uFEFF' + rowsToCsv(records, columns, options) }));
    return buildZip(files);
}

export function exportCsvByDayZip(filenameBase, rows, columns, dateValue, options = {}) {
    downloadBlob(new Blob([buildDailyCsvZip(filenameBase, rows, columns, dateValue, options)], { type: 'application/zip' }), `${filenameBase}-daily-${exportTimestamp()}.zip`);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function resolveWalletPrintBranding(source = typeof document === 'undefined' ? null : document) {
    const theme = source?.documentElement?.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const fallback = `/brand/beverly-mark${theme === 'dark' ? '-light' : ''}.png`;
    let asset = fallback;
    try {
        const value = source?.defaultView?.getComputedStyle(source.documentElement)
            .getPropertyValue('--brand-mark-url').trim();
        const match = value?.match(/^url\((['"]?)(.*?)\1\)$/);
        if (match?.[2]) asset = match[2];
    } catch { /* use the theme-specific fallback */ }
    try {
        return { theme, logoUrl: new URL(asset, source?.baseURI || globalThis.location?.href).href };
    } catch {
        return { theme, logoUrl: asset };
    }
}

export function buildPrintDocument({ title, subtitle = '', rows, columns, meta = [], theme = 'light', logoUrl = '' }) {
    const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
    const metaMarkup = meta.map((item) => (
        `<div class="meta"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`
    )).join('');
    const tableRows = rows.map((row) => (
        `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`
    )).join('');
    return `<!doctype html><html lang="en" data-theme="${resolvedTheme}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        :root{--paper:#fff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--head:#f1f5f9;--stripe:#f8fafc;--brand-name:#0f172a}
        :root[data-theme="dark"]{--paper:#0b1118;--ink:#f8fafc;--muted:#94a3b8;--line:#263442;--head:#16212b;--stripe:#101923;--brand-name:#f8fafc}
        *{box-sizing:border-box}html,body{background:var(--paper)}body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);margin:36px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #16a34a;padding-bottom:16px;margin-bottom:24px}
        .brand{display:flex;align-items:center;gap:12px}.brand img{width:42px;height:42px;object-fit:contain}.brand-name{color:var(--brand-name);font-size:13px;font-weight:800;letter-spacing:.02em}
        h1{font-size:22px;margin:1px 0 0}.sub,.stamp{color:var(--muted);font-size:12px}.stamp{text-align:right}.metas{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:22px}
        .meta{display:grid;gap:2px}.meta span{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em}.meta strong{font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:11px}th{text-align:left;background:var(--head);padding:8px;color:var(--muted)}td{padding:7px 8px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}
        tr:nth-child(even) td{background:var(--stripe)}footer{margin-top:24px;padding-top:10px;border-top:1px solid var(--line);color:var(--muted);font-size:10px;text-align:center}
        @page{size:landscape;margin:12mm}@media print{body{margin:0}thead{display:table-header-group}tr{break-inside:avoid}}
      </style></head><body><header><div class="brand">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Beverly" onerror="this.hidden=true">` : ''}<div><div class="brand-name">Beverly</div><h1>${escapeHtml(title)}</h1>${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}</div></div><div class="stamp">Beverly Wallet<br>Generated ${escapeHtml(new Date().toLocaleString())}</div></header>
      ${metaMarkup ? `<div class="metas">${metaMarkup}</div>` : ''}<table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
      <footer>Confidential Beverly wallet record.</footer><script>window.addEventListener('load',async()=>{await Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})})));setTimeout(()=>window.print(),100)});<\/script></body></html>`;
}

export function printPdf(options) {
    if (!options.rows.length) throw new Error('No records available.');
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) throw new Error('Allow popups to export PDF.');
    popup.opener = null;
    popup.document.open();
    popup.document.write(buildPrintDocument({ ...options, ...resolveWalletPrintBranding() }));
    popup.document.close();
}
