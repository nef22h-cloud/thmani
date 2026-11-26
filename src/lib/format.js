const money = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 2 });

export const formatMoney = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `${money.format(Number(n))} ر.س`);
