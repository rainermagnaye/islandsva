/**
 * How a new client pays, shown on the registration link's payment step. One place to change when the account
 * changes. The QR image (public/payment/wise-qr.png) encodes `url`; replace both together.
 */
export const payment = {
  provider: "Wise",
  payee: "Nina Pauline Comia Acasio",
  handle: "@ninaa154",
  url: "https://wise.com/pay/me/ninaa154",
  qr: "/payment/wise-qr.png",
} as const;
