export type DeviceNotificationState = 'unsupported' | 'default' | 'enabled' | 'blocked' | 'unavailable';

export interface PushTransport {
    getConfig(): Promise<{ available: boolean; publicKey: string | null }>;
    save(subscription: PushSubscriptionJSON): Promise<void>;
    remove(endpoint: string): Promise<void>;
}

function supported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

function applicationServerKey(value: string): ArrayBuffer {
    const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

async function readyServiceWorker(scopePath: string): Promise<ServiceWorkerRegistration> {
    const scope = new URL(scopePath, location.origin).href;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        const registration = await navigator.serviceWorker.getRegistration(scope);
        if (registration?.scope === scope && registration.active) return registration;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('This portal’s service worker is unavailable. Reload and try again.');
}

export function createPushNotifications(portal: string, transport: PushTransport, scopePath = '/') {
    const disabledKey = `beverly.${portal}.push.disabled`;
    const disabled = () => {
        try { return localStorage.getItem(disabledKey) === '1'; } catch { return false; }
    };
    const setDisabled = (value: boolean) => {
        try {
            if (value) localStorage.setItem(disabledKey, '1');
            else localStorage.removeItem(disabledKey);
        } catch { /* best effort */ }
    };
    const state = (): DeviceNotificationState => {
        if (!supported()) return 'unsupported';
        if (Notification.permission === 'granted') return disabled() ? 'default' : 'enabled';
        return Notification.permission === 'denied' ? 'blocked' : 'default';
    };
    const subscribe = async (): Promise<DeviceNotificationState> => {
        const config = await transport.getConfig();
        if (!config.available || !config.publicKey) return 'unavailable';
        const registration = await readyServiceWorker(scopePath);
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey(config.publicKey),
            });
        }
        await transport.save(subscription.toJSON());
        setDisabled(false);
        return 'enabled';
    };
    return {
        state,
        async enable(): Promise<DeviceNotificationState> {
            if (!supported()) return 'unsupported';
            const config = await transport.getConfig();
            if (!config.available) return 'unavailable';
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'default';
            return subscribe();
        },
        async sync(): Promise<DeviceNotificationState> {
            return state() === 'enabled' ? subscribe() : state();
        },
        async disable(): Promise<DeviceNotificationState> {
            if (!supported()) return 'unsupported';
            const registration = await readyServiceWorker(scopePath);
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await transport.remove(subscription.endpoint).catch(() => undefined);
                await subscription.unsubscribe();
            }
            setDisabled(true);
            return 'default';
        },
    };
}
