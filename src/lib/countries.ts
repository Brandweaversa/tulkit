// Country list for the mobile-number country selector.
//
// South Africa is pinned first: it is the only country whose numbers are
// SMS-verified and the only one with the OTT voucher payment rail. The rest
// are saved without verification. Dial codes follow ITU E.164.

export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // international dialling code, no "+"
}

export const COUNTRIES: CountryOption[] = [
  { code: "ZA", name: "South Africa", dial: "27" },
  { code: "AO", name: "Angola", dial: "244" },
  { code: "AR", name: "Argentina", dial: "54" },
  { code: "AT", name: "Austria", dial: "43" },
  { code: "AU", name: "Australia", dial: "61" },
  { code: "BE", name: "Belgium", dial: "32" },
  { code: "BW", name: "Botswana", dial: "267" },
  { code: "BR", name: "Brazil", dial: "55" },
  { code: "CA", name: "Canada", dial: "1" },
  { code: "CH", name: "Switzerland", dial: "41" },
  { code: "CD", name: "DR Congo", dial: "243" },
  { code: "CG", name: "Congo", dial: "242" },
  { code: "CN", name: "China", dial: "86" },
  { code: "DE", name: "Germany", dial: "49" },
  { code: "DK", name: "Denmark", dial: "45" },
  { code: "ES", name: "Spain", dial: "34" },
  { code: "ET", name: "Ethiopia", dial: "251" },
  { code: "FI", name: "Finland", dial: "358" },
  { code: "FR", name: "France", dial: "33" },
  { code: "GB", name: "United Kingdom", dial: "44" },
  { code: "GH", name: "Ghana", dial: "233" },
  { code: "GR", name: "Greece", dial: "30" },
  { code: "IE", name: "Ireland", dial: "353" },
  { code: "IL", name: "Israel", dial: "972" },
  { code: "IN", name: "India", dial: "91" },
  { code: "IT", name: "Italy", dial: "39" },
  { code: "JP", name: "Japan", dial: "81" },
  { code: "KE", name: "Kenya", dial: "254" },
  { code: "KR", name: "South Korea", dial: "82" },
  { code: "LS", name: "Lesotho", dial: "266" },
  { code: "MW", name: "Malawi", dial: "265" },
  { code: "MZ", name: "Mozambique", dial: "258" },
  { code: "NA", name: "Namibia", dial: "264" },
  { code: "NG", name: "Nigeria", dial: "234" },
  { code: "NL", name: "Netherlands", dial: "31" },
  { code: "NO", name: "Norway", dial: "47" },
  { code: "NZ", name: "New Zealand", dial: "64" },
  { code: "PK", name: "Pakistan", dial: "92" },
  { code: "PL", name: "Poland", dial: "48" },
  { code: "PT", name: "Portugal", dial: "351" },
  { code: "RE", name: "Réunion", dial: "262" },
  { code: "RO", name: "Romania", dial: "40" },
  { code: "RW", name: "Rwanda", dial: "250" },
  { code: "SA", name: "Saudi Arabia", dial: "966" },
  { code: "SC", name: "Seychelles", dial: "248" },
  { code: "SE", name: "Sweden", dial: "46" },
  { code: "SG", name: "Singapore", dial: "65" },
  { code: "SZ", name: "Eswatini", dial: "268" },
  { code: "TZ", name: "Tanzania", dial: "255" },
  { code: "UG", name: "Uganda", dial: "256" },
  { code: "US", name: "United States", dial: "1" },
  { code: "ZM", name: "Zambia", dial: "260" },
  { code: "ZW", name: "Zimbabwe", dial: "263" },
];

const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): CountryOption | undefined {
  return COUNTRY_MAP.get(code.toUpperCase());
}
