const MILE_NINE_AND_TEN = 'Mile 9 & 10';

export function stationScopeKey(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  const compact = raw.replace(/[\s_\-&]+/g, '');
  return compact === 'MILE9' || compact === 'MILE9AND10' ? 'MILE910' : compact;
}

export function stationDisplayLabel(value) {
  const raw = String(value ?? '').trim();
  return stationScopeKey(raw) === 'MILE910' ? MILE_NINE_AND_TEN : raw;
}
