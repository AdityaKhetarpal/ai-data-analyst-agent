// Lenient result comparison, same rules as agent/step8_test.py: same row count, and every column of the
// correct answer appears in the other table (names, order, extra columns and rounding don't matter).
import type { Cell, Table } from "./types";

type V = [number, number | string];
const norm = (vals: Cell[]): V[] => vals.map((v): V => (v === null ? [0, ""] : typeof v === "number" ? [1, v] : [2, String(v).trim().toLowerCase()]))
  .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
const close = (a: V, b: V) => a[0] === b[0] && (a[0] === 1 ? Math.abs((a[1] as number) - (b[1] as number)) <= Math.max(0.05, 1e-3 * Math.abs(b[1] as number)) : a[1] === b[1]);

export function sameResult(correct: Table, mine: Table): boolean {
  if (correct.rows.length !== mine.rows.length) return false;
  const mineCols = mine.columns.map((_, i) => norm(mine.rows.map((r) => r[i])));
  return correct.columns.every((_, i) => {
    const want = norm(correct.rows.map((r) => r[i]));
    return mineCols.some((got) => got.length === want.length && got.every((g, k) => close(want[k], g)));
  });
}
