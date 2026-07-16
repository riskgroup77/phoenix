/** API amount may be a Decimal string; avoid string concatenation in reduce/sum */
export function txAmount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
