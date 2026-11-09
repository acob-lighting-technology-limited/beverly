/**
 * Admin consumption and alarm analytics routes — /api/v1/admin/consumption/* & /api/v1/admin/abnormal-alarms
 */
import type { FastifyPluginAsync } from 'fastify';
import { adminClient } from '../db/supabase.js';
import { staffStations } from '../services/staff-station-scope.js';

export const adminConsumptionRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/consumption', async (req, reply) => {
        const qs = req.query as Record<string, string>;
        const assignedStations = staffStations(req);
        const scope      = (assignedStations ? 'station' : qs.scope) as 'meter' | 'station' | 'cumulative' ?? 'station';
        const period     = qs.period as 'day' | 'week' | 'month' | 'year' ?? 'month';
        const scope_id   = qs.scope_id || undefined;
        const from       = qs.from ?? undefined;
        const to         = qs.to ?? undefined;
        const limit      = Math.min(Number(qs.limit ?? 120), 500);

        if (!['meter','station','cumulative'].includes(scope)) {
            return reply.code(400).send({ error: 'bad_scope', message: 'scope must be meter | station | cumulative' });
        }
        if (!['day','week','month','year'].includes(period)) {
            return reply.code(400).send({ error: 'bad_period', message: 'period must be day | week | month | year' });
        }

        const { queryConsumption, allStations, stationsAuthority } = await import('../services/consumption.js');
        const authority = assignedStations ? stationsAuthority(assignedStations) : allStations();
        const rows = await queryConsumption(
            { scope, scope_id, period_type: period, from, to, limit, withSpend: qs.spend === 'true' },
            authority,
        );
        return { rows, count: rows.length };
    });

    fastify.get('/consumption/meters', async (req, reply) => {
        const qs         = req.query as Record<string, string>;
        const assignedStations = staffStations(req);
        const station_id = qs.station_id;
        const period     = qs.period as 'day' | 'week' | 'month' | 'year' ?? 'month';
        const from       = qs.from ?? undefined;
        const to         = qs.to ?? undefined;

        if (!station_id) {
            return reply.code(400).send({ error: 'missing_station_id', message: 'station_id is required' });
        }
        if (assignedStations && !assignedStations.includes(station_id.toUpperCase())) {
            return reply.code(404).send({ error: 'not_found', message: 'Station not found for your assignment.' });
        }
        if (!['day','week','month','year'].includes(period)) {
            return reply.code(400).send({ error: 'bad_period', message: 'period must be day | week | month | year' });
        }

        const { queryMeterBreakdown, allStations, stationsAuthority } = await import('../services/consumption.js');
        const authority = assignedStations ? stationsAuthority(assignedStations) : allStations();
        const rows = await queryMeterBreakdown(station_id, period, authority, from, to);
        return { rows, count: rows.length };
    });

    fastify.post('/consumption/refresh', async (req, reply) => {
        try {
            const body = (req.body ?? {}) as { stationId?: string; station_id?: string; stationIds?: string[]; station_ids?: string[] };
            const assignedStations = staffStations(req);
            const stationIds = assignedStations ?? body.stationIds ?? body.station_ids ?? (body.stationId || body.station_id ? [body.stationId ?? body.station_id ?? ''] : undefined);
            const { refreshConsumptionAggregates } = await import('../services/consumption.js');
            const result = await refreshConsumptionAggregates(stationIds);
            return { ...result, ok: true };
        } catch (e: any) {
            return reply.code(500).send({ error: 'refresh_failed', message: e.message, result: e.result });
        }
    });

    fastify.get('/abnormal-alarms', async (req, reply) => {
        const qs = req.query as Record<string, string>;
        const alarm = String(qs.alarm ?? '').trim();
        const stationId = String(qs.station_id ?? '').trim();
        const from = String(qs.from ?? '').trim();
        const to = String(qs.to ?? '').trim();
        const limit = Math.min(Number(qs.limit ?? qs.pageLimit ?? 200), 1000);
        const offset = Math.max(0, Number(qs.offset ?? 0));
        let query = adminClient
            .from('daily_meter_readings')
            .select('meter_id, customer_id, customer_name, station_id, gateway_id, current_date, total1, usage1, battery_low, magnetic_interference, terminal_cover_open, cover_open, current_reverse, current_unbalance, update_date')
            .order('current_date', { ascending: false })
            .range(offset, offset + limit - 1);
        if (stationId) query = query.eq('station_id', stationId);
        if (from) query = query.gte('current_date', from);
        if (to) query = query.lte('current_date', to);
        const { data, error } = await query;
        if (error) return reply.code(500).send({ error: 'read_failed', message: error.message });
        const rows = (data ?? []).flatMap((r: any) => {
            const signals = [
                { key: 'noData', label: 'No Data Report', hit: Number(r.usage1 ?? 0) === 0 },
                { key: 'magneticInterference', label: 'Magnetic Interference', hit: Number(r.magnetic_interference ?? 0) > 0 },
                { key: 'batteryLow', label: 'Battery Low', hit: Number(r.battery_low ?? 0) > 0 },
                { key: 'terminalCoverOpen', label: 'Terminal Cover Open', hit: Number(r.terminal_cover_open ?? 0) > 0 },
                { key: 'coverOpen', label: 'Upper Open', hit: Number(r.cover_open ?? 0) > 0 },
                { key: 'currentReverse', label: 'Current Reverse', hit: Number(r.current_reverse ?? 0) > 0 },
                { key: 'currentUnbalance', label: 'Current Unbalance', hit: Number(r.current_unbalance ?? 0) > 0 },
            ].filter((s) => s.hit).map((s) => ({
                alarmKey: s.key, alarmLabel: s.label,
                meterId: r.meter_id, customerId: r.customer_id, customerName: r.customer_name, stationId: r.station_id, gatewayId: r.gateway_id,
                total1: r.total1, usage1: r.usage1, batteryLow: r.battery_low, magneticInterference: r.magnetic_interference,
                terminalCoverOpen: r.terminal_cover_open, coverOpen: r.cover_open, currentReverse: r.current_reverse, currentUnbalance: r.current_unbalance,
                currentDate: r.current_date, updateDate: r.update_date,
            }));
            return signals;
        }).filter((row: any) => !alarm || row.alarmKey === alarm);
        return { rows, total: rows.length, count: rows.length };
    });

    fastify.get('/consumption/reconcile-audit', async (req) => {
        const qs = req.query as Record<string, string>;
        const assignedStations = staffStations(req);
        const stationId = (assignedStations ? assignedStations[0] : (qs.station_id || qs.stationId || 'TUNGA')).toUpperCase();
        const from = qs.from || new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
        const to = qs.to || new Date().toISOString().slice(0, 10);

        const { auditStationGaps } = await import('../services/consumption-reconciliation.js');
        const { data: metersData } = await adminClient
            .from('customer_meters')
            .select('meter_serial')
            .eq('station_id', stationId)
            .limit(500);
        const activeMeters = (metersData ?? []).map((m: any) => String(m.meter_serial || '').trim()).filter(Boolean);

        const { data: readingsData } = await adminClient
            .from('daily_meter_readings')
            .select('meter_id, reading_date, total1, remain1, usage1')
            .eq('station_id', stationId)
            .gte('reading_date', from)
            .lte('reading_date', to)
            .limit(2000);

        const audit = auditStationGaps(stationId, activeMeters, readingsData ?? [], from, to);
        return { ok: true, audit };
    });

    fastify.post('/consumption/reconcile-audit', async (req) => {
        const body = (req.body ?? {}) as { stationId?: string; from?: string; to?: string };
        const assignedStations = staffStations(req);
        const stationId = (assignedStations ? assignedStations[0] : (body.stationId || 'TUNGA')).toUpperCase();
        const from = body.from || new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
        const to = body.to || new Date().toISOString().slice(0, 10);

        const { auditStationGaps } = await import('../services/consumption-reconciliation.js');
        const { data: metersData } = await adminClient
            .from('customer_meters')
            .select('meter_serial')
            .eq('station_id', stationId)
            .limit(500);
        const activeMeters = (metersData ?? []).map((m: any) => String(m.meter_serial || '').trim()).filter(Boolean);

        const { data: readingsData } = await adminClient
            .from('daily_meter_readings')
            .select('meter_id, reading_date, total1, remain1, usage1')
            .eq('station_id', stationId)
            .gte('reading_date', from)
            .lte('reading_date', to)
            .limit(2000);

        const audit = auditStationGaps(stationId, activeMeters, readingsData ?? [], from, to);
        return { ok: true, triggeredAt: new Date().toISOString(), audit };
    });

    fastify.get('/grid/outages', async () => {
        const { listActiveGridOutages } = await import('../services/grid-outage.js');
        const outages = listActiveGridOutages();
        return { ok: true, outages, count: outages.length };
    });

    fastify.post('/grid/outages/:id/acknowledge', async (req, reply) => {
        const params = req.params as { id: string };
        const body = (req.body ?? {}) as { notes?: string };
        const actor = (req as any).user?.email || (req as any).user?.userId || 'Operations';
        const { acknowledgeGridOutage } = await import('../services/grid-outage.js');
        const acknowledged = acknowledgeGridOutage(params.id, actor, body.notes);
        if (!acknowledged) {
            return reply.code(404).send({ error: 'outage_not_found', message: 'No active grid outage matching the ID' });
        }
        return { ok: true, incidentId: params.id, acknowledgedBy: actor, acknowledgedAt: new Date().toISOString() };
    });

    fastify.get('/grid/analytics/technical-loss', async (req) => {
        const qs = req.query as Record<string, string>;
        const stationId = (qs.station_id || qs.stationId || 'TUNGA').toUpperCase();
        const feederKwh = Number(qs.feeder_kwh || qs.feederKwh || 1250);
        const customerKwh = Number(qs.customer_kwh || qs.customerKwh || 1160);
        const tariff = Number(qs.tariff || 120);

        const { evaluateTechnicalLoss } = await import('../services/consumption-reconciliation.js');
        const report = evaluateTechnicalLoss({
            stationId,
            feederEnergyKwh: feederKwh,
            customerEnergyKwh: customerKwh,
            tariffPerKwh: tariff,
        });
        return { ok: true, report };
    });
};
