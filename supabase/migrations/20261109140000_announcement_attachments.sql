alter table public.admin_announcements
    add column if not exists attachment_name text,
    add column if not exists attachment_content_type text,
    add column if not exists attachment_base64 text;

notify pgrst, 'reload schema';
