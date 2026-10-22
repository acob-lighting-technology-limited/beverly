export interface WalletExportOption {
  label: string;
  value: string;
  description?: string;
}

export interface WalletExportSelection {
  format: 'csv' | 'pdf';
  csvDelivery: 'single' | 'daily-zip';
  since: string;
  until: string;
  status: string;
  station: string;
  actor: string;
  actorType: '' | 'vendor' | 'customer';
  columnKeys: string[];
}
