// منطق سجل المطالبات (بدون اعتماد على المتصفح)

export const CLAIM_STATUS = [
  { id: 'open', label: 'مفتوحة', tone: 'amber' },
  { id: 'inProgress', label: 'قيد المعالجة', tone: 'sky' },
  { id: 'resolved', label: 'انحلّت', tone: 'emerald' },
  { id: 'rejected', label: 'مرفوضة', tone: 'red' },
];

export const CLAIM_OUTCOMES = [
  { id: 'repaired', label: 'صيانة' },
  { id: 'replaced', label: 'استبدال بجهاز جديد' },
  { id: 'refunded', label: 'استرجاع المبلغ' },
  { id: 'other', label: 'غير ذلك' },
];

export const claimStatusById = (id) => CLAIM_STATUS.find((s) => s.id === id) ?? CLAIM_STATUS[0];
export const claimOutcomeById = (id) => CLAIM_OUTCOMES.find((o) => o.id === id) ?? null;

export const isClaimOpen = (c) => c.status === 'open' || c.status === 'inProgress';

/** الاستبدال والاسترجاع عادةً ينهون الضمان؛ الصيانة لا */
export const outcomeEndsWarranty = (outcome) => outcome === 'replaced' || outcome === 'refunded';

/** يجهّز المطالبة للحفظ */
export function normalizeClaim(input) {
  const status = CLAIM_STATUS.some((s) => s.id === input.status) ? input.status : 'open';
  const closed = status === 'resolved' || status === 'rejected';
  const cost = input.cost === '' || input.cost == null ? null : Number(input.cost);
  return {
    ...(input.id ? { id: input.id } : {}),
    warrantyId: Number(input.warrantyId),
    date: input.date,
    issue: String(input.issue ?? '').trim(),
    status,
    outcome: status === 'resolved' ? input.outcome || null : null,
    closedDate: closed ? input.closedDate || input.date : null,
    referenceNumber: String(input.referenceNumber ?? '').trim(),
    cost: Number.isFinite(cost) && cost >= 0 ? cost : null,
    notes: String(input.notes ?? '').trim(),
  };
}

export function validateClaim(c) {
  const errors = {};
  if (!c.issue) errors.issue = 'اكتب وش المشكلة';
  if (!c.date) errors.date = 'حدد تاريخ المطالبة';
  if (c.closedDate && c.date && c.closedDate < c.date) errors.closedDate = 'تاريخ الإغلاق قبل تاريخ المطالبة';
  return errors;
}

/** المفتوحة أولاً، وبعدين الأحدث */
export function sortClaims(list) {
  return [...list].sort((a, b) => Number(isClaimOpen(b)) - Number(isClaimOpen(a)) || (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id);
}

/** عدد الأيام من فتح المطالبة لإغلاقها (أو لليوم لو مفتوحة) */
export function claimDurationDays(c, todayISO) {
  const end = c.closedDate || todayISO;
  if (!c.date || !end) return null;
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(c.date)) / 86400000));
}
