import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClaim, validateClaim, sortClaims, claimDurationDays, outcomeEndsWarranty, isClaimOpen } from './claims.js';
import { buildBackup, parseBackup } from './backup.js';

test('المطالبة: التجهيز للحفظ', () => {
  const open = normalizeClaim({ warrantyId: '3', date: '2026-11-01', issue: '  الشاشة طافية ', status: 'open', outcome: 'replaced', cost: '', closedDate: '2026-11-05' });
  assert.equal(open.warrantyId, 3);
  assert.equal(open.issue, 'الشاشة طافية');
  assert.equal(open.outcome, null); // النتيجة بس للمطالبة اللي انحلّت
  assert.equal(open.closedDate, null);
  assert.equal(open.cost, null);
  const done = normalizeClaim({ warrantyId: 3, date: '2026-11-01', issue: 'x', status: 'resolved', outcome: 'repaired', cost: '150.5' });
  assert.equal(done.closedDate, '2026-11-01');
  assert.equal(done.cost, 150.5);
  assert.equal(normalizeClaim({ warrantyId: 1, date: 'd', issue: 'x', status: 'weird' }).status, 'open');
});

test('المطالبة: التحقق', () => {
  assert.deepEqual(Object.keys(validateClaim({ issue: '', date: '' })).sort(), ['date', 'issue']);
  assert.ok(validateClaim({ issue: 'x', date: '2026-11-05', closedDate: '2026-11-01' }).closedDate);
  assert.deepEqual(validateClaim({ issue: 'x', date: '2026-11-05' }), {});
});

test('المطالبات: المفتوحة أولاً ثم الأحدث، والمدة، والنتائج اللي تنهي الضمان', () => {
  const list = [
    { id: 1, date: '2026-10-01', status: 'resolved' },
    { id: 2, date: '2026-09-01', status: 'open' },
    { id: 3, date: '2026-11-01', status: 'rejected' },
    { id: 4, date: '2026-10-15', status: 'inProgress' },
  ];
  assert.deepEqual(sortClaims(list).map((c) => c.id), [4, 2, 3, 1]);
  assert.equal(claimDurationDays({ date: '2026-11-01', closedDate: '2026-11-08' }, '2026-11-26'), 7);
  assert.equal(claimDurationDays({ date: '2026-11-20' }, '2026-11-26'), 6);
  assert.equal(outcomeEndsWarranty('replaced'), true);
  assert.equal(outcomeEndsWarranty('repaired'), false);
  assert.equal(isClaimOpen({ status: 'inProgress' }), true);
});

test('النسخة الاحتياطية تشمل المطالبات، والنسخ القديمة بدونها تنقرأ', () => {
  const b = buildBackup({
    warranties: [{ id: 5, syncId: 'w', productName: 'x', purchaseDate: '2026-01-01' }],
    images: [],
    claims: [{ id: 1, syncId: 'c1', warrantyId: 5, issue: 'خراب' }, { id: 2, syncId: 'c2', warrantyId: 99, issue: 'يتيمة' }],
    settings: {},
  });
  assert.deepEqual(b.claims, [{ syncId: 'c1', issue: 'خراب', warrantySyncId: 'w' }]);
  assert.equal(parseBackup(JSON.stringify(b)).claims.length, 1);
  const old = { app: 'damani', version: 1, warranties: [], images: [] };
  assert.deepEqual(parseBackup(JSON.stringify(old)).claims, []);
});

test('PDF: ملف صالح بصفحات JPEG', async () => {
  const { buildPdf, jpegSize } = await import('./pdfWriter.js');
  // أصغر JPEG: SOI + SOF0 (2x3) + EOI — يكفي لاختبار البنية
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x03, 0x00, 0x02, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
  assert.deepEqual(jpegSize(jpeg), { width: 2, height: 3 });
  const pdf = buildPdf([{ jpeg, width: 2, height: 3 }, { jpeg, width: 2, height: 3 }], { title: 'ضمان شاشة' });
  const s = new TextDecoder('latin1').decode(pdf);
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  assert.match(s, /\/Count 2/);
  // جدول xref: كل إزاحة تشير لبداية كائنها
  const xref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.ok(s.slice(xref).startsWith('xref'));
  const offs = [...s.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  offs.forEach((o, i) => assert.ok(s.slice(o).startsWith(`${i + 1} 0 obj`), `obj ${i + 1}`));
});
