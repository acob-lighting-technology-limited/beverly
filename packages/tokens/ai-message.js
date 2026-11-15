/**
 * Beverly AI Message Formatter & Route Linkifier (`@beverly/tokens/ai-message.js`)
 *
 * Provides safe HTML rendering, code block styling, and route linkification
 * adapted from the ACOB platform standards.
 */

// Canonical Beverly routes ordered longest-first so sub-paths match before parent prefixes
const BEVERLY_ROUTE_LABELS = [
    ['#/battery-swap/operations', 'Fleet & Swap Operations'],
    ['#/battery-swap/diagnostics', 'Battery Diagnostics Lab'],
    ['#/battery-swap/stations', 'Swap Stations & Racks'],
    ['#/battery-swap/fleet', 'Bike & Battery Registry'],
    ['#/battery-swap/crm', 'Rider Lease CRM'],
    ['#/battery-swap/map', 'Live GPS Tracker'],
    ['#/prepay-report/station-consumption', 'Station Consumption'],
    ['#/prepay-report/consumption-statistics', 'Consumption Statistics'],
    ['#/prepay-report/daily-data-meter', 'Interval Data'],
    ['#/prepay-report/abnormal-alarm', 'Abnormal Alarm'],
    ['#/prepay-report/archive-reports', 'Archive Reports'],
    ['#/token-generate/change-meter-key', 'Change Meter Key'],
    ['#/token-generate/credit-token', 'Credit Token'],
    ['#/token-generate/clear-tamper-token', 'Clear Tamper Token'],
    ['#/token-generate/clear-credit-token', 'Clear Credit Token'],
    ['#/token-generate/set-maximum-power-limit-token', 'Power Limit Token'],
    ['#/token-record/credit-token-record', 'Credit Token Record'],
    ['#/remote-operation/remote-meter-reading', 'Meter Reading'],
    ['#/remote-operation/remote-meter-control', 'Meter Control'],
    ['#/remote-operation/remote-meter-token', 'Meter Token'],
    ['#/system/station-onboarding-studio', 'Station Onboarding Studio'],
    ['#/system/automation-command', 'Automation Command'],
    ['#/telemetry/power-quality', 'Power Quality'],
    ['#/telemetry/demand-curves', 'Demand Curves'],
    ['#/grid-control/remote-relay', 'Remote Relay Control'],
    ['#/analytics/energy-audit', 'Energy Audit & Theft'],
    ['#/mesh/gateways', 'Gateway & Mesh Health'],
    ['#/management/gateway', 'Gateway Management'],
    ['#/management/customer', 'Customer Management'],
    ['#/management/tariff', 'Tariff Management'],
    ['#/management/account', 'Account Management'],
    ['#/admin/reports', 'Report Centre'],
    ['#/admin/station', 'Station Admin'],
    ['#/admin/meter', 'Meter Admin'],
    ['#/admin/debt', 'Debt Admin'],
    ['#/admin/user', 'User Admin'],
    ['#/admin/role', 'Role Admin'],
    ['#/admin/log', 'Audit Log'],
    ['#/dashboard', 'Dashboard'],
    ['#/wallet', 'Wallet Admin'],
    ['#/guide', 'Beverly Guide'],
    ['#/disputes', 'Disputes'],
    ['/fleet', 'Bike & Battery Registry'],
    ['/stations', 'Swap Stations & Racks'],
    ['/crm', 'Rider Lease CRM'],
    ['/diagnostics', 'Battery Diagnostics Lab'],
    ['/map', 'Live GPS Tracker'],
];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/**
 * Linkify route paths and bold page titles to proper markdown links
 */
export function linkifyBeverlyRoutes(input) {
    let text = String(input ?? '');

    // Pass 1 — bare or backticked paths -> links, leaving existing [label](path) intact
    for (const [path, label] of BEVERLY_ROUTE_LABELS) {
        const esc = escapeRegExp(path);
        // If already in [label](path), don't touch
        const re = new RegExp(`(\\]\\(${esc}\\))|\`${esc}\`|(?<![\\w/\\#-])${esc}(?![\\w/\\#-])`, 'g');
        text = text.replace(re, (match, existingTail) => (existingTail ? match : `[${label}](${path})`));
    }

    // Pass 2 — bold page names (**Fleet & Swap Operations**) -> links if not already linked
    for (const [path, label] of BEVERLY_ROUTE_LABELS) {
        if (text.includes(`](${path})`)) continue;
        const re = new RegExp(`\\*\\*${escapeRegExp(label)}\\*\\*`, 'g');
        text = text.replace(re, `[${label}](${path})`);
    }

    return text;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatInline(value) {
    let text = String(value);

    // Markdown links: [label](href)
    // Note: href and label are already escaped if passed through escapeHtml first
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
        const isInternal = href.startsWith('#') || href.startsWith('/');
        return `<a href="${href}" class="beverly-ai-route-link" data-route="${href}" ${isInternal ? '' : 'target="_blank" rel="noopener noreferrer"'}>${label}</a>`;
    });

    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code class="beverly-ai-inline-code">$1</code>');

    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    return text;
}

/**
 * Format Beverly AI bot response into styled, safe HTML
 */
export function formatAiMessage(value) {
    if (!value) return '';

    // Step 1: Pre-linkify recognized Beverly routes
    const linkified = linkifyBeverlyRoutes(value);

    // Step 2: Separate fenced code blocks from prose
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const blocks = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(linkified)) !== null) {
        if (match.index > lastIndex) {
            blocks.push({ type: 'prose', content: linkified.slice(lastIndex, match.index) });
        }
        blocks.push({ type: 'code', lang: match[1]?.trim() || '', content: match[2] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < linkified.length) {
        blocks.push({ type: 'prose', content: linkified.slice(lastIndex) });
    }

    const outputParts = [];

    for (const block of blocks) {
        if (block.type === 'code') {
            const escapedCode = escapeHtml(block.content.trim());
            if (block.lang === 'action-card') {
                outputParts.push(
                    `<div class="beverly-ai-action-card-box"><span class="beverly-ai-action-badge">Suggested Action</span><pre class="beverly-ai-action-pre"><code>${escapedCode}</code></pre></div>`
                );
            } else {
                outputParts.push(
                    `<pre class="beverly-ai-code-block"><code class="language-${block.lang || 'text'}">${escapedCode}</code></pre>`
                );
            }
            continue;
        }

        // Process prose
        const rawLines = block.content.trim().split(/\r?\n/);
        let listItems = [];

        const flushList = () => {
            if (!listItems.length) return;
            outputParts.push(`<ul class="beverly-ai-ul">${listItems.map((item) => `<li>${formatInline(escapeHtml(item))}</li>`).join('')}</ul>`);
            listItems = [];
        };

        for (const rawLine of rawLines) {
            const line = rawLine.trim();
            const bullet = line.match(/^[-•]\s+(.+)$/);
            if (bullet) {
                listItems.push(bullet[1]);
                continue;
            }

            flushList();
            if (!line) continue;

            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                const level = heading[1].length;
                const tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
                outputParts.push(`<${tag} class="beverly-ai-${tag}">${formatInline(escapeHtml(heading[2]))}</${tag}>`);
            } else {
                outputParts.push(`<p class="beverly-ai-p">${formatInline(escapeHtml(line))}</p>`);
            }
        }
        flushList();
    }

    return outputParts.join('');
}
