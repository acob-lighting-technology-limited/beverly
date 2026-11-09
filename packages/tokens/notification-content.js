/**
 * Turns plain notification copy into safe display blocks.
 * The source remains text, never executable HTML.
 */
export function formatNotificationBody(value) {
    const normalized = String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    if (!normalized) return [];

    const lines = normalized
        .replace(/\s+(?=(?:[⚡📲📊🛡️]\s*)?\d+[.)]\s+)/gu, '\n')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.map((text) => {
        const numbered = text.match(/^(?:([⚡📲📊🛡️])\s*)?(\d+)[.)]\s+(.+)$/u);
        if (!numbered) return { kind: 'paragraph', text };
        return {
            kind: 'item',
            marker: `${numbered[1] ? `${numbered[1]} ` : ''}${numbered[2]}`,
            text: numbered[3].trim(),
        };
    });
}

/** A small, escaped formatting subset shared by email and its preview. */
export function formatAnnouncementMarkup(value) {
    const source = String(value ?? '').replace(/\r\n?/g, '\n').trim();
    const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = (text) => escape(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    const html = [];
    const plain = [];
    let list = [];
    const flushList = () => {
        if (!list.length) return;
        html.push(`<ol style="margin:0 0 18px;padding-left:22px;">${list.map((item) => `<li style="margin:0 0 8px;">${inline(item)}</li>`).join('')}</ol>`);
        plain.push(...list.map((item, index) => `${index + 1}. ${item}`));
        list = [];
    };
    for (const raw of source.split('\n')) {
        const line = raw.trim();
        const numbered = line.match(/^\d+\.\s+(.+)$/);
        if (numbered) { list.push(numbered[1]); continue; }
        flushList();
        if (!line) { plain.push(''); continue; }
        const heading = line.match(/^#\s+(.+)$/);
        if (heading) html.push(`<h2 style="font-size:18px;line-height:1.4;margin:0 0 14px">${inline(heading[1])}</h2>`);
        else html.push(`<p style="margin:0 0 18px;">${inline(line)}</p>`);
        plain.push(heading?.[1] ?? line);
    }
    flushList();
    return { html: html.join(''), text: plain.join('\n').replace(/\*\*/g, '').replace(/\*/g, '') };
}
