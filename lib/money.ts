/** All money in the app is integer kobo. ₦1 = 100 kobo. */

const formatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(kobo: number) {
  return formatter.format(Math.round(kobo) / 100);
}

export function formatPrice(kobo: number) {
  return kobo === 0 ? "Free" : formatNaira(kobo);
}

export function nairaToKobo(naira: number) {
  return Math.round(naira * 100);
}
