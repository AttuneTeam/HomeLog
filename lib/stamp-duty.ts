type OwnershipType = "investment" | "primary_residence";

interface Bracket {
  threshold: number;
  base: number;
  rate: number;
}

function applyBrackets(price: number, brackets: Bracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (price >= brackets[i].threshold) {
      return brackets[i].base + (price - brackets[i].threshold) * brackets[i].rate;
    }
  }
  return 0;
}

const NSW_BRACKETS: Bracket[] = [
  { threshold: 0,         base: 0,         rate: 0.0125 },
  { threshold: 17_000,    base: 212.50,    rate: 0.0150 },
  { threshold: 37_000,    base: 512.50,    rate: 0.0175 },
  { threshold: 99_000,    base: 1_597.50,  rate: 0.0350 },
  { threshold: 372_000,   base: 11_152.50, rate: 0.0450 },
  { threshold: 1_240_000, base: 50_212.50, rate: 0.0550 },
];

const VIC_GENERAL_BRACKETS: Bracket[] = [
  { threshold: 0,           base: 0,         rate: 0.0140 },
  { threshold: 25_000,      base: 350,        rate: 0.0240 },
  { threshold: 130_000,     base: 2_870,      rate: 0.0600 },
  // 960k–2M handled separately (flat on full value)
  { threshold: 2_000_000,   base: 110_000,    rate: 0.0650 },
];

const VIC_PPR_BRACKETS: Bracket[] = [
  { threshold: 0,       base: 0,      rate: 0.0140 },
  { threshold: 25_000,  base: 350,    rate: 0.0240 },
  { threshold: 130_000, base: 2_870,  rate: 0.0500 },
  { threshold: 440_000, base: 18_370, rate: 0.0600 },
];

const QLD_STANDARD_BRACKETS: Bracket[] = [
  { threshold: 0,           base: 0,        rate: 0.0000 },
  { threshold: 5_000,       base: 0,        rate: 0.0150 },
  { threshold: 75_000,      base: 1_050,    rate: 0.0350 },
  { threshold: 540_000,     base: 17_325,   rate: 0.0450 },
  { threshold: 1_000_000,   base: 38_025,   rate: 0.0575 },
];

const QLD_HOME_BRACKETS: Bracket[] = [
  { threshold: 0,         base: 0,       rate: 0.0100 },
  { threshold: 350_000,   base: 3_500,   rate: 0.0350 },
  { threshold: 540_000,   base: 10_150,  rate: 0.0450 },
  { threshold: 1_000_000, base: 30_850,  rate: 0.0575 },
];

const SA_BRACKETS: Bracket[] = [
  { threshold: 0,       base: 0,        rate: 0.0100 },
  { threshold: 12_000,  base: 120,      rate: 0.0200 },
  { threshold: 30_000,  base: 480,      rate: 0.0300 },
  { threshold: 50_000,  base: 1_080,    rate: 0.0350 },
  { threshold: 100_000, base: 2_830,    rate: 0.0400 },
  { threshold: 200_000, base: 6_830,    rate: 0.0425 },
  { threshold: 250_000, base: 8_955,    rate: 0.0475 },
  { threshold: 300_000, base: 11_330,   rate: 0.0500 },
  { threshold: 500_000, base: 21_330,   rate: 0.0550 },
];

const WA_BRACKETS: Bracket[] = [
  { threshold: 0,       base: 0,        rate: 0.0190 },
  { threshold: 120_000, base: 2_280,    rate: 0.0285 },
  { threshold: 150_000, base: 3_135,    rate: 0.0380 },
  { threshold: 360_000, base: 11_115,   rate: 0.0475 },
  { threshold: 725_000, base: 28_453,   rate: 0.0515 },
];

const TAS_BRACKETS: Bracket[] = [
  { threshold: 3_000,   base: 50,       rate: 0.0175 },
  { threshold: 25_000,  base: 435,      rate: 0.0225 },
  { threshold: 75_000,  base: 1_560,    rate: 0.0350 },
  { threshold: 200_000, base: 5_935,    rate: 0.0400 },
  { threshold: 375_000, base: 12_935,   rate: 0.0425 },
  { threshold: 725_000, base: 27_810,   rate: 0.0450 },
];

const ACT_OWNER_BRACKETS: Bracket[] = [
  { threshold: 0,         base: 0,        rate: 0.0028 },
  { threshold: 260_000,   base: 728,      rate: 0.0220 },
  { threshold: 300_000,   base: 1_608,    rate: 0.0340 },
  { threshold: 500_000,   base: 8_408,    rate: 0.0432 },
  { threshold: 750_000,   base: 19_208,   rate: 0.0590 },
  { threshold: 1_000_000, base: 33_958,   rate: 0.0640 },
];

const ACT_INVESTOR_BRACKETS: Bracket[] = [
  { threshold: 0,         base: 0,        rate: 0.0120 },
  { threshold: 200_000,   base: 2_400,    rate: 0.0220 },
  { threshold: 300_000,   base: 4_600,    rate: 0.0340 },
  { threshold: 500_000,   base: 11_400,   rate: 0.0432 },
  { threshold: 750_000,   base: 22_200,   rate: 0.0590 },
  { threshold: 1_000_000, base: 36_950,   rate: 0.0640 },
];

const STATE_MAP: Record<string, string> = {
  "nsw": "NSW", "new south wales": "NSW",
  "vic": "VIC", "victoria": "VIC",
  "qld": "QLD", "queensland": "QLD",
  "sa": "SA",   "south australia": "SA",
  "wa": "WA",   "western australia": "WA",
  "tas": "TAS", "tasmania": "TAS",
  "act": "ACT", "australian capital territory": "ACT",
  "nt": "NT",   "northern territory": "NT",
};

function normaliseState(input: string): string | null {
  return STATE_MAP[input.trim().toLowerCase()] ?? null;
}

function calcNSW(price: number): number {
  return Math.max(applyBrackets(price, NSW_BRACKETS), 20);
}

function calcVIC(price: number, type: OwnershipType): number {
  if (price >= 960_000 && price <= 2_000_000) return price * 0.055;
  if (type === "primary_residence" && price < 550_000) {
    return applyBrackets(price, VIC_PPR_BRACKETS);
  }
  return applyBrackets(price, VIC_GENERAL_BRACKETS);
}

function calcQLD(price: number, type: OwnershipType): number {
  const brackets = type === "primary_residence" ? QLD_HOME_BRACKETS : QLD_STANDARD_BRACKETS;
  return applyBrackets(price, brackets);
}

function calcTAS(price: number): number {
  if (price <= 3_000) return 50;
  return applyBrackets(price, TAS_BRACKETS);
}

function calcACT(price: number, type: OwnershipType): number {
  if (price >= 1_455_000) return price * 0.0454;
  const brackets = type === "primary_residence" ? ACT_OWNER_BRACKETS : ACT_INVESTOR_BRACKETS;
  return applyBrackets(price, brackets);
}

function calcNT(price: number): number {
  const v = price / 1000;
  if (price <= 525_000) return 0.06571441 * v * v + 15 * v;
  if (price <= 2_999_999) return price * 0.0495;
  if (price <= 4_999_999) return price * 0.0575;
  return price * 0.0595;
}

export function calculateStampDuty(
  stateInput: string,
  price: number,
  ownershipType: OwnershipType,
): number | null {
  if (!stateInput || price <= 0) return null;
  const state = normaliseState(stateInput);
  if (!state) return null;

  let duty: number;
  switch (state) {
    case "NSW": duty = calcNSW(price); break;
    case "VIC": duty = calcVIC(price, ownershipType); break;
    case "QLD": duty = calcQLD(price, ownershipType); break;
    case "SA":  duty = applyBrackets(price, SA_BRACKETS); break;
    case "WA":  duty = applyBrackets(price, WA_BRACKETS); break;
    case "TAS": duty = calcTAS(price); break;
    case "ACT": duty = calcACT(price, ownershipType); break;
    case "NT":  duty = calcNT(price); break;
    default: return null;
  }
  return Math.round(duty);
}
