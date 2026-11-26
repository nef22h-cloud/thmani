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

test('OCR: بيانات المنتج والضمان كاملة', () => {
  const text = `متجر النخبة للإلكترونيات
فاتورة ضريبية مبسطة
الفرع: الرياض - حي النرجس
هاتف: 011 234 5678
الرقم الضريبي: 310123456700003
التاريخ: 20/11/2026 الوقت: 14:30
المنتج: شاشة تلفزيون سمارت 55 بوصة
الموديل: UA55X900
الرقم التسلسلي: SN55TV8842X
الباركود: 6291041500213
الكمية: 1 السعر: 1,999.13
مدة الضمان: سنتين
الاسترجاع خلال 7 أيام من تاريخ الشراء
الإجمالي شامل الضريبة 2,299.00 ر.س`;
  const r = parseInvoiceText(text, '2026-11-26');
  assert.equal(r.storeName, 'متجر النخبة للإلكترونيات');
  assert.equal(r.branch, 'الرياض - حي النرجس');
  assert.equal(r.phone, '0112345678');
  assert.equal(r.productName, 'شاشة تلفزيون سمارت 55 بوصة');
  assert.equal(r.category, 'electronics');
  assert.equal(r.model, 'UA55X900');
  assert.equal(r.serialNumber, 'SN55TV8842X');
  assert.equal(r.barcode, '6291041500213');
  assert.deepEqual(r.warranty, { value: 2, unit: 'years' });
  assert.equal(r.returnDays, 7);
  assert.equal(r.total, 2299);
});

test('OCR: صيغ ضمان وتسلسلي إنجليزية', () => {
  const r = parseInvoiceText('Product: Galaxy S25\nS/N: R58X12AB9\nWarranty: 24 months\n14 days return policy', '2026-11-26');
  assert.equal(r.serialNumber, 'R58X12AB9');
  assert.equal(r.category, 'phones');
  assert.deepEqual(r.warranty, { value: 24, unit: 'months' });
});

test('OCR: قيمة قبل التسمية وعلامات اتجاه', () => {
  const r = parseInvoiceText('UA55X900 ‏الموديل:‎\nالرقم التسلسلي: ‎SN55TV8842X‏', '2026-11-26');
  assert.equal(r.model, 'UA55X900');
  assert.equal(r.serialNumber, 'SN55TV8842X');
});

test('OCR: فاتورة حقيقية مصوّرة (جدول أصناف + ضمان بالكلمات + ضوضاء)', () => {
  const text = `‎AlDelco 1 is‏
© إبداعات الحجاز للتجارة “ 1 م هلا — ري
بيع بطازيات المركبات بالجملة والتج 4 5 239454 سه مي
تلمون 0509255546 1 - ص7 جسم
الرقم الضرنى 311669934200003
فرع ‎gle‏ الحج نوع الفاتورة: مبيعات
م الحمبق + : التاريخ 09:00:41 13-10-2026 8
رقم الصنف البيانٌ الوحدة الكمية السعر الاجمالي بدون ‎Gd eas)‏ الضريبة ‎Jad‏
‏ضيبة الضريبة
360 16 بطارية اسيديلكو > ‎2a78 15 [ 1es.22 Teal‏ 190.00
المدفوع شبكة - لخصم 0.00
= صضريية القيمة المضافة 9615 24.78
‏الإجمالي بعد الضريبة 7190.00 )
**بلاحظة ** لضمان لايشمل الكسر و الانفجار او العين البيضاء
ضمان مركبات الديزل والاجرة ستة أشهر من تاريخ`;
  const r = parseInvoiceText(text, '2026-11-26');
  assert.equal(r.storeName, 'إبداعات الحجاز للتجارة');
  assert.equal(r.phone, '0509255546');
  assert.equal(r.productName, 'بطارية اسيديلكو');
  assert.equal(r.category, 'cars');
  assert.equal(r.total, 190);
  assert.equal(r.purchaseDate, '2026-10-13');
  assert.equal(r.branch, 'الحج');
  assert.deepEqual(r.warranty, { value: 6, unit: 'months' });
});

test('OCR: ألف ساقطة وسطر باركود قبل الكمية', () => {
  const r = parseInvoiceText('| لمنتج : شاشة تلفزيون سمارت 55 بوصة\nالباركود: 6291041500213\nالكمية: 1', '2026-11-26');
  assert.equal(r.productName, 'شاشة تلفزيون سمارت 55 بوصة');
  assert.equal(r.storeName, null);
});

test('اسم البائع بدون الصفة القانونية', async () => {
  const { cleanSellerName } = await import('./prefill.js');
  assert.equal(cleanSellerName('شركة حلول نون للتسويق الإلكتروني شركة شخص واحد'), 'شركة حلول نون للتسويق الإلكتروني');
  assert.equal(cleanSellerName('شركة إكسترا للتجارة ذات مسؤولية محدودة'), 'شركة إكسترا للتجارة');
  assert.equal(cleanSellerName('مكتبة جرير (مساهمة عامة)'), 'مكتبة جرير');
  assert.equal(cleanSellerName('متجر النخبة'), 'متجر النخبة');
});

test('OCR: فاتورة نون (جدول رأسه موزّع على أسطر، اسم إنجليزي، Serial Nr)', () => {
  const text = `فاتورة الضريبة البائع المشتري
الرقم الضريبي للمنشأة 302004655210003 شركة حلول نون للتسويق الإلكتروني شركة ش ‎Naif‏
تاريخ الفاتورة 2026-08-27 ‎Kingdom of Saudi Arabia‏
المستند المصدر 568075030116038
الرقم شامل | ضريبة ‏ ضر
" كود المنتج الوصف ‎aed‏ ضريبة القيمة القيمة 0 ‎are‏
المضافة سعودي) ‎JU)‏ سعودي)
‎Z2F7EFC3E2477155FAC15Z- 1‏ هايبركس ‎HyperX Cloud Ill Wired Gaming Headset,‏ 1 34 15.00% 34.96 268.00
‎Product Serial Nr 45222733‏
المجموع الفرعي 233.04 ‎Ju,‏
‏ضريبة القيمة المضافة 34.96 ‎Ju,‏
‏المجموع 268.00 ‎Ju,‏`;
  const r = parseInvoiceText(text, '2026-11-26');
  assert.equal(r.productName, 'هايبركس HyperX Cloud Ill Wired Gaming Headset');
  assert.equal(r.category, 'electronics');
  assert.equal(r.serialNumber, '45222733');
  assert.equal(r.barcode, null);
  assert.equal(r.branch, null);
  assert.equal(r.total, 268);
});
