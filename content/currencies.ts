import { formatPrice, packages } from "./packages";

const EURO = [
  "Andorra", "Austria", "Belgium", "Croatia", "Cyprus", "Estonia", "Finland", "France", "Germany", "Greece",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Monaco", "Montenegro", "Netherlands",
  "Portugal", "San Marino", "Slovakia", "Slovenia", "Spain", "Vatican City",
];
const USD = [
  "Ecuador", "El Salvador", "Micronesia", "Marshall Islands", "Palau", "Panama", "Puerto Rico", "Timor-Leste", "United States",
];

function assign(names: readonly string[], currency: string, into: Record<string, string>) {
  for (const name of names) into[name] = currency;
}

const COUNTRY_CURRENCY: Record<string, string> = {};
assign(EURO, "EUR", COUNTRY_CURRENCY);
assign(USD, "USD", COUNTRY_CURRENCY);
assign(["United Kingdom"], "GBP", COUNTRY_CURRENCY);
assign(["Australia"], "AUD", COUNTRY_CURRENCY);
assign(["New Zealand"], "NZD", COUNTRY_CURRENCY);
assign(["Canada"], "CAD", COUNTRY_CURRENCY);
assign(["Switzerland", "Liechtenstein"], "CHF", COUNTRY_CURRENCY);
assign(["Japan"], "JPY", COUNTRY_CURRENCY);
assign(["China"], "CNY", COUNTRY_CURRENCY);
assign(["Hong Kong"], "HKD", COUNTRY_CURRENCY);
assign(["Taiwan"], "TWD", COUNTRY_CURRENCY);
assign(["Singapore", "Brunei"], "SGD", COUNTRY_CURRENCY);
assign(["India", "Bhutan"], "INR", COUNTRY_CURRENCY);
assign(["Philippines"], "PHP", COUNTRY_CURRENCY);
assign(["South Korea", "North Korea"], "KRW", COUNTRY_CURRENCY);
assign(["Thailand"], "THB", COUNTRY_CURRENCY);
assign(["Malaysia"], "MYR", COUNTRY_CURRENCY);
assign(["Indonesia"], "IDR", COUNTRY_CURRENCY);
assign(["Vietnam"], "VND", COUNTRY_CURRENCY);
assign(["United Arab Emirates"], "AED", COUNTRY_CURRENCY);
assign(["Saudi Arabia"], "SAR", COUNTRY_CURRENCY);
assign(["Qatar"], "QAR", COUNTRY_CURRENCY);
assign(["Kuwait"], "KWD", COUNTRY_CURRENCY);
assign(["Bahrain"], "BHD", COUNTRY_CURRENCY);
assign(["Oman"], "OMR", COUNTRY_CURRENCY);
assign(["South Africa"], "ZAR", COUNTRY_CURRENCY);
assign(["Nigeria"], "NGN", COUNTRY_CURRENCY);
assign(["Kenya"], "KES", COUNTRY_CURRENCY);
assign(["Ghana"], "GHS", COUNTRY_CURRENCY);
assign(["Egypt"], "EGP", COUNTRY_CURRENCY);
assign(["Morocco"], "MAD", COUNTRY_CURRENCY);
assign(["Brazil"], "BRL", COUNTRY_CURRENCY);
assign(["Mexico"], "MXN", COUNTRY_CURRENCY);
assign(["Argentina"], "ARS", COUNTRY_CURRENCY);
assign(["Chile"], "CLP", COUNTRY_CURRENCY);
assign(["Colombia"], "COP", COUNTRY_CURRENCY);
assign(["Peru"], "PEN", COUNTRY_CURRENCY);
assign(["Sweden"], "SEK", COUNTRY_CURRENCY);
assign(["Norway"], "NOK", COUNTRY_CURRENCY);
assign(["Denmark"], "DKK", COUNTRY_CURRENCY);
assign(["Poland"], "PLN", COUNTRY_CURRENCY);
assign(["Czechia"], "CZK", COUNTRY_CURRENCY);
assign(["Hungary"], "HUF", COUNTRY_CURRENCY);
assign(["Romania"], "RON", COUNTRY_CURRENCY);
assign(["Turkey"], "TRY", COUNTRY_CURRENCY);
assign(["Israel"], "ILS", COUNTRY_CURRENCY);
assign(["Pakistan"], "PKR", COUNTRY_CURRENCY);
assign(["Bangladesh"], "BDT", COUNTRY_CURRENCY);
assign(["Sri Lanka"], "LKR", COUNTRY_CURRENCY);
assign(["Nepal"], "NPR", COUNTRY_CURRENCY);

/**
 * Units of each currency per 1 US dollar. Fixed, approximate rates (moneyexchangerate.org, 3 November 2026); update them
 * now and then. Packages are priced in US dollars, so a converted price is always shown next to the USD amount.
 */
export const RATES_AS_OF = "2026-11-03";
const USD_RATES: Record<string, number> = {
  USD: 1, EUR: 0.8938, GBP: 0.7459, AUD: 1.4289, NZD: 1.78, CAD: 1.3985, CHF: 0.819, JPY: 157.91, CNY: 6.6479,
  HKD: 7.8464, TWD: 32.607, SGD: 1.2791, INR: 94.684, PHP: 63.306, KRW: 1345.57, THB: 33.72, MYR: 4.0721,
  IDR: 18130.7, VND: 25773.2, AED: 3.6729, SAR: 3.7644, QAR: 3.6539, KWD: 0.3114, BHD: 0.3773, OMR: 0.3845,
  ZAR: 16.615, NGN: 1340.93, KES: 129.95, GHS: 11.653, EGP: 55.349, MAD: 9.8284, BRL: 5.4372, MXN: 18.584,
  ARS: 1545.22, CLP: 980.39, COP: 3199.39, PEN: 3.467, SEK: 9.7866, NOK: 9.317, DKK: 6.6796, PLN: 3.947,
  CZK: 21.75, HUF: 325.66, RON: 4.7697, TRY: 49.989, ILS: 3.1405, PKR: 276.5, BDT: 124.34, LKR: 332.31, NPR: 151.7,
};

/** ISO currency for a country name. Unknown countries, and currencies without a rate, stay on US dollars. */
export function currencyForCountry(country: string) {
  const currency = COUNTRY_CURRENCY[country.trim()];
  return currency && USD_RATES[currency] ? currency : "USD";
}

/** A US cent amount in another currency's minor units (x100), at the fixed rate above. */
export function convertFromUsd(usdCents: number, currency: string) {
  return Math.round(usdCents * (USD_RATES[currency] ?? 1));
}

/** The price in the country's currency, e.g. "PHP 98,757". US dollars where there is no rate. */
export function formatLocalPrice(usdCents: number, country: string) {
  const currency = currencyForCountry(country);
  return formatPrice(convertFromUsd(usdCents, currency), currency, "code");
}

/**
 * A catalogue price for a country: converted, with the US dollar amount it comes from, e.g. "PHP 98,757 (USD 1,560)".
 * Just "USD 1,560" for countries that use US dollars.
 */
export function formatPackagePrice(usdCents: number, country: string) {
  const usd = formatPrice(usdCents, "USD", "code");
  return currencyForCountry(country) === "USD" ? usd : `${formatLocalPrice(usdCents, country)} (${usd})`;
}

/** Month to month package prices in a country's currency, for the discovery call form (loaded once a country is chosen). */
export function localPackagePrices(country: string) {
  const terms = "Save 5% on a 6 month term or 10% on 12 months.";
  const usd = currencyForCountry(country) === "USD";
  return {
    bySlug: Object.fromEntries(packages.map((p) => [p.slug, formatPackagePrice(p.monthlyPrice[1], country)])) as Record<string, string>,
    hint: usd
      ? `Month to month prices at $9 an hour. ${terms}`
      : `Month to month prices in ${currencyForCountry(country)} at an approximate exchange rate; packages are billed at $9 (USD) an hour. ${terms}`,
  };
}
