export function purchasePageCursor(row: { created_at: string; id: string }): string {
    return `${row.created_at}|${row.id}`;
}

export function applyPurchasePageCursor<T extends { or(filter: string): T; lt(column: string, value: string): T }>(query: T, cursor?: string): T {
    if (!cursor) return query;
    const parts = cursor.split('|');
    const [createdAt, id] = parts;
    if (parts.length > 2 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(createdAt)
        || Number.isNaN(Date.parse(createdAt)) || (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
        throw new Error('Invalid purchase cursor.');
    }
    return id
        ? query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`)
        : query.lt('created_at', createdAt);
}
