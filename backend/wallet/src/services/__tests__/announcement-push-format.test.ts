import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAnnouncementMarkup } from '@beverly/tokens/notification-content';
import { createPushNotifications } from '@beverly/tokens/push-notifications';
import { adminAnnouncementEmail } from '../../emails/templates.js';

afterEach(() => vi.unstubAllGlobals());

describe('announcement rendering', () => {
    it('escapes author HTML while retaining chosen emphasis', () => {
        const body = '# Update\n**Ready** and *soon* <script>alert(1)</script>';
        const formatted = formatAnnouncementMarkup(body);
        expect(formatted.html).toContain('<h2');
        expect(formatted.html).toContain('<strong>Ready</strong>');
        expect(formatted.html).toContain('<em>soon</em>');
        expect(formatted.html).toContain('&lt;script&gt;');
        expect(formatted.html).not.toContain('<script>');
        expect(adminAnnouncementEmail({ name: 'Ada', title: 'Update', body }).html).toContain(formatted.html);
    });
});

describe('device push registration', () => {
    it('subscribes through the portal worker scope', async () => {
        const subscription = { endpoint: 'https://push.example/1', keys: { p256dh: 'key', auth: 'auth' } };
        const save = vi.fn();
        const getRegistration = vi.fn().mockResolvedValue({
            scope: 'https://beverly.example/wallet-admin/', active: {},
            pushManager: { getSubscription: vi.fn().mockResolvedValue({ toJSON: () => subscription }) },
        });
        vi.stubGlobal('location', { origin: 'https://beverly.example' });
        vi.stubGlobal('window', { PushManager: true, Notification: true });
        vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') });
        vi.stubGlobal('navigator', { serviceWorker: { getRegistration } });
        vi.stubGlobal('localStorage', { getItem: () => null, removeItem: vi.fn() });
        const push = createPushNotifications('admin', { getConfig: async () => ({ available: true, publicKey: 'key' }), save, remove: vi.fn() }, '/wallet-admin/');
        expect(await push.enable()).toBe('enabled');
        expect(getRegistration).toHaveBeenCalledWith('https://beverly.example/wallet-admin/');
        expect(save).toHaveBeenCalledWith(subscription);
    });
});
