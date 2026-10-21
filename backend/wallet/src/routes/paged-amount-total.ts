type AmountPage = {
    data: Array<{ amount_minor: number | null }> | null;
    count: number | null;
    error: { message: string } | null;
};

export async function pagedAmountTotal(fetchPage: (start: number, end: number) => PromiseLike<AmountPage>): Promise<{ count: number; amountMinor: number }> {
    const pageSize = 1_000;
    let count: number | null = null;
    let seen = 0;
    let amountMinor = 0;
    while (count === null || seen < count) {
        const page = await fetchPage(seen, seen + pageSize - 1);
        if (page.error) throw new Error(page.error.message);
        if (count === null) count = page.count;
        if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Amount count unavailable.');
        const rows = page.data ?? [];
        if (rows.length === 0 && seen < count) throw new Error('Amount page incomplete.');
        for (const row of rows) {
            const amount = Number(row.amount_minor ?? 0);
            if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(amountMinor + amount)) {
                throw new Error('Invalid amount total.');
            }
            amountMinor += amount;
        }
        seen += rows.length;
    }
    if (seen !== count) throw new Error('Amount count changed during summary.');
    return { count, amountMinor };
}
