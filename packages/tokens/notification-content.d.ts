export interface NotificationParagraphBlock {
    kind: 'paragraph';
    text: string;
}

export interface NotificationItemBlock {
    kind: 'item';
    marker: string;
    text: string;
}

export type NotificationContentBlock = NotificationParagraphBlock | NotificationItemBlock;

export declare function formatNotificationBody(value: unknown): NotificationContentBlock[];
export declare function formatAnnouncementMarkup(value: unknown): { html: string; text: string };
