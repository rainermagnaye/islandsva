import { formatPrice } from "./packages";

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

/** ISO currency for a country name. Unknown countries stay on US dollars. */
export function currencyForCountry(country: string) {
  return COUNTRY_CURRENCY[country.trim()] ?? "USD";
}

/** The catalogue amount, labelled with the ISO code of the chosen country's currency. */
export function formatPackagePrice(usdCents: number, country: string) {
  return formatPrice(usdCents, currencyForCountry(country), "code");
}
