export interface WalletExportOptions {
    includeTotals?: boolean;
}

export interface WalletExportColumn<T = Record<string, unknown>> {
    key: string;
    header: string;
    value: (row: T) => unknown;
    actorTypes?: Array<'vendor' | 'customer'>;
    aggregate?: 'sum' | 'none';
    isMoney?: boolean;
}

export interface WalletExportMeta {
    label: string;
    value: string;
}

export interface WalletPrintOptions<T = Record<string, unknown>> {
    title: string;
    subtitle?: string;
    rows: T[];
    columns: WalletExportColumn<T>[];
    meta?: WalletExportMeta[];
    theme?: 'light' | 'dark';
    logoUrl?: string;
}

export interface WalletPrintBranding {
    theme: 'light' | 'dark';
    logoUrl: string;
}

export declare function sanitizeSpreadsheetValue(value: unknown): string;
export declare function isMoneyColumn<T>(column: WalletExportColumn<T>, sampleRows?: T[]): boolean;
export declare function parseMoneyNumber(raw: unknown): number;
export declare function formatMoneyTotal(sum: number, sampleValue?: unknown): string;
export declare function rowsToCsv<T>(rows: T[], columns: WalletExportColumn<T>[], options?: WalletExportOptions | boolean): string;
export declare function exportTimestamp(date?: Date): string;
export declare function downloadBlob(blob: Blob, filename: string): void;
export declare function exportCsv<T>(filenameBase: string, rows: T[], columns: WalletExportColumn<T>[], options?: WalletExportOptions | boolean): void;
export declare function buildDailyCsvZip<T>(filenameBase: string, rows: T[], columns: WalletExportColumn<T>[], dateValue: (row: T) => string | null | undefined, options?: WalletExportOptions | boolean): Uint8Array;
export declare function exportCsvByDayZip<T>(filenameBase: string, rows: T[], columns: WalletExportColumn<T>[], dateValue: (row: T) => string | null | undefined, options?: WalletExportOptions | boolean): void;
export declare function resolveWalletPrintBranding(source?: Document | null): WalletPrintBranding;
export declare function buildPrintDocument<T>(options: WalletPrintOptions<T>): string;
export declare function printPdf<T>(options: WalletPrintOptions<T>): void;
