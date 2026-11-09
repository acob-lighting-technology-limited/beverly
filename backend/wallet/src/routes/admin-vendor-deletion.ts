import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';
import { auditFromRequest, logAction } from '../services/audit.js';

const route: FastifyPluginAsync = async (fastify) => {
    fastify.get('/vendors/:id/deletion-check', async (req, reply) => {
        const id = z.string().uuid().parse((req.params as { id: string }).id);
        const { data, error } = await adminClient.rpc('admin_vendor_deletion_check', { p_vendor_id: id });
        if (error?.code === 'P0002') return reply.code(404).send({ error: 'not_found', message: 'Vendor not found.' });
        if (error) throw error;
        return data;
    });

    fastify.delete('/vendors/:id', async (req, reply) => {
        const id = z.string().uuid().parse((req.params as { id: string }).id);
        const body = z.object({
            reason: z.string().trim().min(4).max(500),
            confirmation: z.string().trim().min(1).max(160),
        }).parse(req.body ?? {});
        const { data: vendor, error: readError } = await adminClient.from('vendor_organizations')
            .select('*').eq('id', id).maybeSingle();
        if (readError) throw readError;
        if (!vendor || vendor.deleted_at) return reply.code(404).send({ error: 'not_found', message: 'Vendor not found.' });
        if (body.confirmation !== vendor.legal_name) {
            return reply.code(400).send({ error: 'confirmation_mismatch', message: 'Type the exact vendor name.' });
        }

        const { data: deletion, error } = await adminClient.rpc('admin_soft_delete_vendor', {
            p_vendor_id: id, p_deleted_by: req.actor!.userId, p_reason: body.reason,
        });
        if (error?.code === 'P0002') return reply.code(404).send({ error: 'not_found', message: 'Vendor not found.' });
        if (error?.message?.startsWith('vendor deletion blocked:')) {
            return reply.code(409).send({ error: 'vendor_deletion_blocked', message: 'Resolve the vendor’s financial work before deleting.', details: error.message });
        }
        if (error) throw error;

        const authUserIds: string[] = Array.isArray(deletion?.authUserIds)
            ? deletion.authUserIds.filter((value: unknown): value is string => typeof value === 'string') : [];
        let cleanupPending = 0;
        for (const authUserId of authUserIds) {
            const { error: signOutError } = await adminClient.auth.admin.signOut(authUserId, 'global');
            if (signOutError) req.log.warn({ err: signOutError, authUserId, vendorId: id }, 'Vendor session revocation failed');
            const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId, true);
            if (deleteError) {
                cleanupPending++;
                req.log.error({ err: deleteError, authUserId, vendorId: id }, 'Vendor auth deletion failed');
            }
        }

        await logAction({
            ...auditFromRequest(req), action: 'vendor.deleted', targetType: 'vendor_organization', targetId: id,
            before: vendor as Record<string, unknown>, after: { status: 'closed', deleted: true },
            metadata: { reason: body.reason, authUsersRemoved: authUserIds.length - cleanupPending,
                sharedAuthUsersPreserved: deletion?.sharedAuthUsers ?? 0, cleanupPending },
        });
        return { ok: true, id, authUsersRemoved: authUserIds.length - cleanupPending,
            sharedAuthUsersPreserved: deletion?.sharedAuthUsers ?? 0, cleanupPending };
    });
};

export default route;
