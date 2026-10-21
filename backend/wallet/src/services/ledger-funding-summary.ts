import { adminClient } from '../db/supabase.js';

type FundingCredit = {
    amount_minor: number;
    reference_id: string | null;
    reference_type: string | null;
};

type FundingSource = { id: string; channel?: string | null; gateway?: string | null };

export function classifyFundingCredits(
    credits: FundingCredit[],
    requests: FundingSource[],
    payments: FundingSource[],
) {
    const requestById = new Map(requests.map((row) => [row.id, row]));
    const paymentById = new Map(payments.map((row) => [row.id, row]));
    const result = {
        fundingCount: 0, fundingValueMinor: 0,
        paystackFundingCount: 0, paystackFundingValueMinor: 0,
        bankFundingCount: 0, bankFundingValueMinor: 0,
        otherFundingCount: 0, otherFundingValueMinor: 0,
    };
    for (const credit of credits) {
        const amount = Number(credit.amount_minor);
        if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(result.fundingValueMinor + amount)) {
            throw new Error('Invalid wallet funding amount.');
        }
        const source = credit.reference_type === 'funding_request'
            ? requestById.get(String(credit.reference_id))?.channel
            : credit.reference_type === 'payment_transaction'
                ? paymentById.get(String(credit.reference_id))?.gateway
                : null;
        const prefix = source === 'paystack' ? 'paystackFunding' : source === 'bank_transfer' ? 'bankFunding' : 'otherFunding';
        result.fundingCount += 1;
        result.fundingValueMinor += amount;
        const countKey = `${prefix}Count` as 'paystackFundingCount' | 'bankFundingCount' | 'otherFundingCount';
        const valueKey = `${prefix}ValueMinor` as 'paystackFundingValueMinor' | 'bankFundingValueMinor' | 'otherFundingValueMinor';
        result[countKey] += 1;
        result[valueKey] += amount;
    }
    return result;
}

export async function ledgerFundingSummary(walletId: string | undefined) {
    if (!walletId) return classifyFundingCredits([], [], []);
    const credits: FundingCredit[] = [];
    const pageSize = 1_000;
    let total: number | null = null;
    while (total === null || credits.length < total) {
        const { data, count, error } = await adminClient.from('wallet_ledger_entries')
            .select('amount_minor, reference_id, reference_type', { count: 'exact' })
            .eq('wallet_id', walletId).eq('direction', 'credit')
            .in('entry_type', ['funding_credit', 'payment_credit'])
            .order('id').range(credits.length, credits.length + pageSize - 1);
        if (error) throw error;
        if (total === null) total = count;
        if (total === null || !Number.isSafeInteger(total) || total < 0 || (!data?.length && credits.length < total)) {
            throw new Error('Wallet funding history is incomplete.');
        }
        credits.push(...(data ?? []) as FundingCredit[]);
    }
    if (credits.length !== total) throw new Error('Wallet funding history changed during summary.');

    const referenceIds = (type: string) => [...new Set(credits
        .filter((row) => row.reference_type === type)
        .map((row) => row.reference_id).filter((id): id is string => Boolean(id)))];
    const fetchSources = async (table: 'funding_requests' | 'payment_transactions', ids: string[], columns: string) => {
        const rows: FundingSource[] = [];
        for (let index = 0; index < ids.length; index += 100) {
            const { data, error } = await adminClient.from(table).select(columns).in('id', ids.slice(index, index + 100));
            if (error) throw error;
            rows.push(...(data ?? []) as unknown as FundingSource[]);
        }
        return rows;
    };
    const [requests, payments] = await Promise.all([
        fetchSources('funding_requests', referenceIds('funding_request'), 'id, channel'),
        fetchSources('payment_transactions', referenceIds('payment_transaction'), 'id, gateway'),
    ]);
    return classifyFundingCredits(credits, requests, payments);
}
