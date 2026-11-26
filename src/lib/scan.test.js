import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeZatcaQR, encodeZatcaQR, parseTLV, splitTimestamp, isValidVatNumber } from './zatca.js';
import { findDates, parseInvoiceText, pickTotal, normalizeDigits } from './invoiceParser.js';

test('ZATCA: فك QR مولّد بالعربي', () => {
  const qr = encodeZatcaQR({ sellerName: 'شركة إكسترا', vatNumber: '300055184400003', timestamp: '2026-11-20T14:35:00', total: '2499.00', vatAmount: '325.96' });
  const r = decodeZatcaQR(qr);
  assert.equal(r.sellerName, 'شركة إكسترا');
  assert.equal(r.vatNumber, '300055184400003');
  assert.equal(r.date, '2026-11-20');
  assert.equal(r.time, '14:35');
  assert.equal(r.total, 2499);
  assert.equal(r.vatAmount, 325.96);
});

test('ZATCA: بايتات TLV مبنية يدوياً (مثال الهيئة بتوقيت UTC)', () => {
  const tlv = (tag, str) => [tag, Buffer.byteLength(str), ...Buffer.from(str)];
  const bytes = [
    ...tlv(1, 'Bobs Records'),
    ...tlv(2, '310122393500003'),
    ...tlv(3, '2022-04-25T15:30:00Z'),
    ...tlv(4, '1000.00'),
    ...tlv(5, '150.00'),
  ];
  const r = decodeZatcaQR(Buffer.from(bytes).toString('base64'));
  assert.equal(r.sellerName, 'Bobs Records');
  assert.equal(r.vatNumber, '310122393500003');
  assert.equal(r.total, 1000);
  assert.equal(r.vatAmount, 150);
  // 15:30 UTC = 18:30 بتوقيت السعودية
  assert.equal(r.date, '2022-04-25');
  assert.equal(r.time, '18:30');
});

test('ZATCA: طول غير مطابق = مرفوض', () => {
  const bad = Buffer.from([1, 13, ...Buffer.from('Bobs Records'), 2, 1, 51]).toString('base64');
  assert.equal(decodeZatcaQR(bad), null);
});

test('ZATCA: يتجاهل وسوم المرحلة 2 الثنائية', () => {
  const base = Buffer.from(encodeZatcaQR({ sellerName: 'A Store', vatNumber: '300000000000003', timestamp: '2026-01-01 10:00:00', total: '115', vatAmount: '15' }), 'base64');
  const extra = Buffer.from([6, 3, 0xff, 0x00, 0xfe, 8, 0x81, 0x90, ...new Array(0x90).fill(7)]);
  const r = decodeZatcaQR(Buffer.concat([base, extra]).toString('base64'));
  assert.equal(r.sellerName, 'A Store');
  assert.equal(r.time, '10:00');
});

test('ZATCA: يرفض أي QR ثاني', () => {
  assert.equal(decodeZatcaQR('https://example.com/invoice/123'), null);
  assert.equal(decodeZatcaQR('hello world this is not tlv data'), null);
  assert.equal(decodeZatcaQR(''), null);
  assert.throws(() => parseTLV(Uint8Array.from([1, 10, 65])));
});

test('توقيت وأرقام ضريبية', () => {
  assert.deepEqual(splitTimestamp('2026-12-31T22:00:00Z'), { date: '2027-01-01', time: '01:00' });
  assert.ok(isValidVatNumber('300055184400003'));
  assert.ok(!isValidVatNumber('123'));
});

test('OCR: الأرقام العربية والتواريخ', () => {
  assert.equal(normalizeDigits('٢٠٢٦/١١/٢٠'), '2026/11/20');
  assert.deepEqual(findDates('التاريخ: ٢٠/١١/٢٠٢٦ الوقت 10:30'), ['2026-11-20']);
  assert.deepEqual(findDates('Date 2026-03-05'), ['2026-03-05']);
  assert.deepEqual(findDates('12/25/2026'), ['2026-12-25']);
});

test('OCR: فاتورة كاملة', () => {
  const text = `فاتورة ضريبية مبسطة
إكسترا
فرع العليا - الرياض
الرقم الضريبي: 300055184400003
التاريخ: 20/11/2026 14:35
غسالة سامسونج 9 كجم     1 x 2,173.04
المجموع قبل الضريبة 2,173.04
ضريبة القيمة المضافة 15% 325.96
الإجمالي شامل الضريبة 2,499.00
هاتف 920000000`;
  const r = parseInvoiceText(text, '2026-11-26');
  assert.equal(r.storeName, 'إكسترا');
  assert.equal(r.purchaseDate, '2026-11-20');
  assert.equal(r.total, 2499);
  assert.equal(r.vatNumber, '300055184400003');
  assert.equal(r.phone, '920000000');
});

test('OCR: إجمالي إنجليزي وسطر منفصل', () => {
  assert.equal(pickTotal('Subtotal 100.00\nVAT 15.00\nGrand Total\nSAR 115.00'), 115);
  assert.equal(pickTotal('items...\n 45.50 \n 120.75 \n'), 120.75);
});
