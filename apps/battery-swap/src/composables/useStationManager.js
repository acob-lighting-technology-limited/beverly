/**
 * useStationManager
 * Reusable helper logic and formatting for Battery Swap Stations
 */

export function readyBatteries(station) {
  return (station?.activeBatteries || []).filter(b => b.status === 'ready');
}

export function chargingBatteries(station) {
  return (station?.activeBatteries || []).filter(b => b.status === 'charging');
}

export function getEmptySlotsCount(station) {
  const occupied = (station?.activeBatteries || []).length;
  return Math.max(0, (station?.totalSlots || 8) - occupied);
}

export function getLockerSlots(station) {
  const total = station?.totalSlots || 8;
  const batteries = station?.activeBatteries || [];
  const slots = [];

  for (let i = 1; i <= total; i++) {
    const bat = batteries[i - 1];
    if (bat) {
      slots.push({
        doorNumber: i,
        status: bat.status,
        battery: bat
      });
    } else {
      slots.push({
        doorNumber: i,
        status: 'empty',
        battery: null
      });
    }
  }
  return slots;
}

export function getChargeColor(soc) {
  if (soc >= 80) return 'var(--brand, #22c55e)';
  if (soc >= 40) return '#f59e0b';
  return '#ef4444';
}

export function getMapDirectionsUrl(station) {
  if (station?.lat && station?.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station?.address || station?.name || '')}`;
}

export function formatTimestamp(ts) {
  if (!ts) return 'Just now';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return ts;
  }
}

export function fmtNaira(minor) {
  const n = (Number(minor) || 0) / 100;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function filterStations(stations, query = '', activeFilter = 'all') {
  let list = stations || [];

  if (activeFilter === 'ready') {
    list = list.filter(s => (s.activeBatteries || []).some(b => b.status === 'ready'));
  } else if (activeFilter === 'lagos') {
    list = list.filter(s => (s.city || '').toLowerCase().includes('lagos'));
  } else if (activeFilter === 'abuja') {
    list = list.filter(s => (s.city || '').toLowerCase().includes('abuja'));
  }

  if (query.trim()) {
    const q = query.toLowerCase().trim();
    list = list.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.operatorName || '').toLowerCase().includes(q)
    );
  }

  return list;
}
