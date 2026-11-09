import { formatMoneyTotal, isMoneyColumn, parseMoneyNumber } from '@beverly/tokens/wallet-export';

export type Column<T> = {
    key: string;
    header: string;
    value: (row: T) => unknown;
    aggregate?: 'sum' | 'none';
    isMoney?: boolean;
};

export type ExportOptions = {
    includeTotals?: boolean;
};

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value);
    const s = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv<T>(rows: T[], columns: Column<T>[], options?: ExportOptions | boolean): string {
    const includeTotals = typeof options === 'boolean' ? options : Boolean(options?.includeTotals);
    const header = columns.map((column) => csvEscape(column.header)).join(',');
    const body = rows.map((row) => columns.map((column) => csvEscape(column.value(row))).join(','));

    if (includeTotals && rows.length > 0) {
        const moneyColIndices = new Set<number>();
        columns.forEach((column, index) => {
            if (isMoneyColumn(column, rows)) moneyColIndices.add(index);
        });

        if (moneyColIndices.size > 0) {
            let labelIndex = columns.findIndex((_, index) => !moneyColIndices.has(index));
            if (labelIndex === -1) labelIndex = 0;

            const totalCells = columns.map((column, index) => {
                if (moneyColIndices.has(index)) {
                    let sum = 0;
                    let firstSample: unknown = null;
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

export function exportCsv<T>(filenameBase: string, rows: T[], columns: Column<T>[], options?: ExportOptions | boolean): void {
    const opts = options !== undefined ? options : { includeTotals: true };
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rowsToCsv(rows, columns, opts)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenameBase}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
