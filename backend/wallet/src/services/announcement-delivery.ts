import { formatAnnouncementMarkup } from '@beverly/tokens/notification-content';
import { sendWebPush } from './push-notifications.js';
import { z } from 'zod';
import { adminAnnouncementEmail } from '../emails/templates.js';
import { batchCompatibleHtml } from '../adapters/resend.js';

export function previewAnnouncementEmail(input: { title: string; body: string; name: string }) {
    const email = adminAnnouncementEmail(input);
    return { ...email, html: batchCompatibleHtml(email.html) };
}

export const announcementAttachmentSchema = z.object({
    name: z.string().trim().min(1).max(120).regex(/^[^\\/\r\n]+$/),
    mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
    base64: z.string().min(4).max(2_800_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

export interface AnnouncementAttachment {
    name: string;
    mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
    base64: string;
}

export function validAnnouncementAttachment(file: AnnouncementAttachment): boolean {
    const content = Buffer.from(file.base64, 'base64');
    const signatures = {
        'application/pdf': content.subarray(0, 5).toString() === '%PDF-',
        'image/png': content.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
        'image/jpeg': content.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
    };
    const extensions = { 'application/pdf': /\.pdf$/i, 'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i };
    return content.length <= 2_000_000 && signatures[file.mimeType] && extensions[file.mimeType].test(file.name);
}

export async function dispatchAnnouncementDevicePush(
    recipients: Array<{ type: 'customer' | 'vendor' | 'staff'; id: string }>,
    title: string,
    body: string,
    announcementId: string,
): Promise<{ accepted: number; failed: number; unsubscribed: number }> {
    const result = { accepted: 0, failed: 0, unsubscribed: 0 };
    const plainBody = formatAnnouncementMarkup(body).text;
    for (let offset = 0; offset < recipients.length; offset += 100) {
        const attempts = await Promise.allSettled(recipients.slice(offset, offset + 100).map((recipient) =>
            sendWebPush(recipient.type, recipient.id, {
                title, body: plainBody, url: '/notifications', tag: `announcement:${announcementId}`,
            }, recipient.type === 'staff' ? 'admin' : recipient.type)));
        for (const attempt of attempts) {
            if (attempt.status === 'rejected') { result.failed++; continue; }
            result.accepted += attempt.value.sent;
            result.failed += attempt.value.failed;
            if (!attempt.value.sent && !attempt.value.failed) result.unsubscribed++;
        }
    }
    return result;
}
