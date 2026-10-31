/**
 * Currency and Money Utility (PRD Section 0.3, D16)
 * 
 * Money is NEVER a float.
 * All arithmetic in integer minor units (paise: 1 INR = 100 paise).
 * Formatted with Indian digit grouping: 1,25,000.00
 */

/**
 * Format paise into Indian Rupee currency string
 * e.g. 156000n -> "₹1,560.00"
 * e.g. 12500000n -> "₹1,25,000.00"
 */
export function formatINR(paise: bigint | number): string {
  const p = typeof paise === 'bigint' ? paise : BigInt(paise);
  const isNegative = p < 0n;
  const abs = isNegative ? -p : p;
  const rupees = abs / 100n;
  const remainder = abs % 100n;
  const paiseStr = remainder.toString().padStart(2, '0');

  // Indian number formatting on rupees: last 3 digits, then pairs of 2 digits
  const s = rupees.toString();
  let formattedRupees = '';
  if (s.length <= 3) {
    formattedRupees = s;
  } else {
    const lastThree = s.slice(-3);
    const otherDigits = s.slice(0, -3);
    // group by 2 from the right
    const parts: string[] = [];
    let rem = otherDigits;
    while (rem.length > 2) {
      parts.unshift(rem.slice(-2));
      rem = rem.slice(0, -2);
    }
    if (rem.length > 0) {
      parts.unshift(rem);
    }
    formattedRupees = parts.join(',') + ',' + lastThree;
  }

  return `${isNegative ? '-' : ''}₹${formattedRupees}.${paiseStr}`;
}

/**
 * Convert rupee decimal string/number (e.g. "1250.50" or 1250.5) to integer paise (125050n)
 */
export function toPaise(rupees: number | string): bigint {
  const str = typeof rupees === 'number' ? rupees.toFixed(2) : rupees.trim();
  const parts = str.split('.');
  const whole = BigInt(parts[0] || '0');
  let fractionStr = (parts[1] || '0').padEnd(2, '0').slice(0, 2);
  const frac = BigInt(fractionStr);
  return whole * 100n + (whole < 0n ? -frac : frac);
}

/**
 * Convert paise (bigint) to rupees decimal string for display without symbol
 */
export function toRupeesString(paise: bigint | number): string {
  const p = typeof paise === 'bigint' ? paise : BigInt(paise);
  const isNegative = p < 0n;
  const abs = isNegative ? -p : p;
  const rupees = abs / 100n;
  const remainder = abs % 100n;
  return `${isNegative ? '-' : ''}${rupees}.${remainder.toString().padStart(2, '0')}`;
}
