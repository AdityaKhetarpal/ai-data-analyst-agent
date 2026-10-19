// Query planner: turns common business questions straight into SQL, using the SAME business definitions
// the AI is given (agent/step3_schema.py). A question is read as: metric + breakdown + filters + period + ranking.
// If any part is unclear or the question is more complex than that, it says so instead of guessing,
// and the question goes to the AI agent (or the visitor is asked to be more specific).
import vocabJson from "@/public/data/vocab.json";

export type Vocab = Record<"category" | "brand" | "product_name" | "city" | "state" | "segment" | "payment_method" | "status", string[]>;
export type Plan =
  | { kind: "sql"; sql: string }
  | { kind: "clarify"; question: string }      // vague: ask the visitor
  | { kind: "pass"; reason: string };          // too complex for the planner: hand to the AI

const VOCAB = vocabJson as Vocab;
const LINE = "oi.quantity * oi.unit_price_inr * (1 - oi.discount_pct / 100.0)";
const VALID = "o.status IN ('delivered', 'shipped')";
const DATA_END = { y: 2026, m: 9 };          // data runs to 30 Sep 2026; "today" is 1 Oct 2026

type Metric = "revenue" | "units" | "aov" | "orders" | "cancel_rate" | "return_rate" | "delivery" | "discount" | "customers" | "signups" | "products" | "price";
type Dim = "category" | "brand" | "product" | "city" | "state" | "segment" | "payment" | "status" | "month" | "year" | "customer";
type Filter = { field: keyof Vocab; values: string[] };
type Period = { from: string; to: string };

const esc = (s: string) => s.replace(/'/g, "''");
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthRange = (y: number, m1: number, m2 = m1): Period => ({ from: `${y}-${pad(m1)}-01`, to: `${y}-${pad(m2)}-${pad(lastDay(y, m2))}` });
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// ---------- 1. what to measure ----------
function findMetric(q: string): Metric | null {
  if (/average order value|\baov\b|avg\.? order value|average basket|basket size/.test(q)) return "aov";
  if (/return(s|ed)? rate|rate of returns?/.test(q)) return "return_rate";
  if (/cancel\w* rate|rate of cancel/.test(q)) return "cancel_rate";
  if (/deliver\w* (time|speed|days)|days to deliver|time to deliver|shipping time|how (long|fast)/.test(q)) return "delivery";
  if (/discount/.test(q)) return "discount";
  if (/sign ?-?ups?|signed up|new customers|joined|registrations?/.test(q)) return "signups";
  if (/expensive|cheapest|priciest|list price|\bprices?\b/.test(q)) return "price";
  if (/(how many|number of|count of) (different |unique |distinct )?(customers|buyers|shoppers|clients)/.test(q)) return "customers";
  if (/\bunits?\b|quantity|items sold|pieces/.test(q)) return "units";
  if (/revenue|\bsales\b|turnover|\bgmv\b|\bearn|income|money|\bspen[dt]|spending|sold for|made/.test(q)) return "revenue";
  if (/\borders?\b|purchases|transactions|cancelled|canceled|returned|returns|delivered|most (used|popular|common)|used (the )?most|popular|common/.test(q)) return "orders";
  if (/customers?|buyers|shoppers|clients|users/.test(q)) return "customers";
  if (/(how many|number of|count of) (different )?products/.test(q)) return "products";
  return null;
}

// ---------- 2. how to break it down ----------
const DIM_WORDS: Array<[Dim, string]> = [
  ["category", "categor(?:y|ies)"], ["brand", "brands?"], ["product", "products?|items?"], ["city", "cit(?:y|ies)"],
  ["state", "states?"], ["segment", "segments?"], ["payment", "payment(?: methods?| modes?| types?)?|payment"],
  ["status", "status(?:es)?"], ["month", "months?"], ["year", "years?"], ["customer", "customers?|buyers"],
];
function findDim(q: string): Dim | null {
  if (/\bmonthly\b|month[- ]by[- ]month|over time|\btrend\b|each month|per month|by month|month[- ]wise/.test(q)) return "month";
  if (/\byearly\b|year[- ]by[- ]year|each year|per year|by year|year[- ]wise/.test(q)) return "year";
  for (const [dim, words] of DIM_WORDS) {
    const w = `(?:${words})`;
    const patterns = [
      `\\b(?:by|per|each|every|across|for each|for every|split by|broken down by|grouped by)\\s+(?:the\\s+)?${w}\\b`,
      `\\b(?:which|what)\\s+(?:\\w+\\s+){0,1}${w}\\b`,
      `\\b(?:top|bottom|best|worst|highest|lowest|biggest|smallest|leading|least|most|cheapest|priciest)\\s+(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\\s*(?:\\w+\\s+){0,1}${w}\\b`,
      `\\b${w}[- ]wise\\b`, `\\bin each ${w}\\b`, `\\bwho are (?:our|the)\\b.*\\b${w}\\b`,
    ];
    if (patterns.some((p) => new RegExp(p).test(q))) return dim;
  }
  return null;
}

// ---------- 3. filters: names of categories, cities, brands... ----------
function findFilters(q: string, original: string): Filter[] {
  const out: Filter[] = [];
  const add = (field: keyof Vocab, value: string) => {
    const f = out.find((x) => x.field === field);
    if (f) { if (!f.values.includes(value)) f.values.push(value); } else out.push({ field, values: [value] });
  };
  const has = (name: string) => new RegExp(`\\b${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q);
  for (const v of VOCAB.category) if (has(v) || (v === "Home & Kitchen" && /home (and|n) kitchen/.test(q))) add("category", v);
  for (const v of VOCAB.product_name) if (has(v)) add("product_name", v);
  for (const v of VOCAB.city) if (has(v)) add("city", v);
  for (const v of VOCAB.state) if (has(v) && !VOCAB.city.includes(v)) add("state", v);
  for (const v of VOCAB.brand) if (new RegExp(`\\b${v}\\b`).test(original) || has(`${v} brand`) || has(`brand ${v}`)) add("brand", v);
  if (/\bupi\b/.test(q)) add("payment_method", "UPI");
  if (/\bcards?\b|credit card|debit card/.test(q)) add("payment_method", "Card");
  if (/cash on delivery|\bcod\b/.test(q)) add("payment_method", "Cash on Delivery");
  if (/net ?banking/.test(q)) add("payment_method", "Net Banking");
  if (/\bwallets?\b/.test(q)) add("payment_method", "Wallet");
  if (/\bbusiness\b|\bb2b\b/.test(q)) add("segment", "Business");
  if (/\bconsumers?\b|\bb2c\b|individual/.test(q)) add("segment", "Consumer");
  if (/\bcancel(l)?ed\b|cancellations?/.test(q)) add("status", "cancelled");
  if (/\breturned\b|\breturns\b/.test(q)) add("status", "returned");
  if (/\bdelivered\b/.test(q)) add("status", "delivered");
  if (/\bshipped\b|in transit/.test(q)) add("status", "shipped");
  return out;
}

// ---------- 4. time period ----------
function findPeriod(q: string): Period | "two" | "future" | null {
  const years = [...new Set([...q.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1])))];
  if (years.length > 1) return "two";
  if (years.some((y) => y > 2026 || y < 2025)) return "future";
  if (/\bthis month\b|\btoday\b|\byesterday\b|this week|next /.test(q)) return "future";
  if (/last month|previous month|past month/.test(q)) return monthRange(DATA_END.y, DATA_END.m);
  const lastN = q.match(/(?:last|past|previous) (\d+|two|three|four|five|six|twelve) months/);
  if (lastN) {
    const n = Number(lastN[1]) || NUM[lastN[1]];
    const start = new Date(Date.UTC(DATA_END.y, DATA_END.m - n, 1));
    return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: "2026-09-30" };
  }
  if (/(?:last|past) (30 days|week)/.test(q)) return monthRange(2026, 9);
  if (/festive season|diwali/.test(q) && !years.length) return { from: "2025-10-01", to: "2025-11-30" };
  const year = /this year|year to date|\bytd\b/.test(q) ? 2026 : /last year|previous year/.test(q) ? 2025 : years[0];
  const quarter = q.match(/\bq([1-4])\b|\b(first|second|third|fourth) quarter\b/);
  if (quarter) {
    const n = Number(quarter[1]) || ["first", "second", "third", "fourth"].indexOf(quarter[2]) + 1;
    const y = year ?? (n <= 3 ? 2026 : 2025);
    if (y === 2026 && n === 4) return "future";
    return monthRange(y, n * 3 - 2, n * 3);
  }
  const monthsSaid = [...q.matchAll(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/g)].map((m) => MONTHS.indexOf(m[1].slice(0, 3)) + 1);
  if (monthsSaid.length === 2 && /\b(to|and|through|till|until|-|–)\b|–|-/.test(q)) {
    const [a, b] = [Math.min(...monthsSaid), Math.max(...monthsSaid)];
    const y = year ?? (b <= DATA_END.m ? 2026 : 2025);
    if (y === 2026 && b > DATA_END.m) return "future";
    return monthRange(y, a, b);
  }
  const month = q.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (month && !(month[1] === "may" && /\bmay (i|we|you)\b/.test(q))) {
    const m = MONTHS.indexOf(month[1].slice(0, 3)) + 1;
    const y = year ?? (m <= DATA_END.m ? 2026 : 2025);
    if (y === 2026 && m > DATA_END.m) return "future";
    return monthRange(y, m);
  }
  if (year) return { from: `${year}-01-01`, to: `${year}-12-31` };
  return null;
}

function findLimit(q: string): number | null {
  const m = q.match(/\b(?:top|bottom|best|worst|first|which|what)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/) ?? q.match(/\b(\d+|three|five|ten)\s+(?:best|top|highest|lowest|biggest|most)\b/);
  if (m) return Number(m[1]) || NUM[m[1]];
  return null;
}

// Things the planner does not try: comparisons over time, thresholds, per-order maths, "never" questions...
const TOO_COMPLEX = /\b(vs\.?|versus|compared?|comparison|growth|grow|grew|change[ds]?|increase[ds]?|decrease[ds]?|declined?|more than|less than|fewer than|at least|at most|over \d|under \d|above \d|below \d|never|without|only once|repeat|retention|churn|first order|last order|per order|per customer|average number|contain(ed|s)?|both|ratio|median|between|difference|same|rank(ed|ing)?|cohort|lifetime|clv|ltv|day of (the )?week|weekend|weekday|hour)\b/;

const DIM_SQL: Record<Dim, { select: string; group: string; needs: "p" | "c" | "o" | "date" }> = {
  category: { select: "p.category", group: "p.category", needs: "p" },
  brand: { select: "p.brand", group: "p.brand", needs: "p" },
  product: { select: "p.product_name", group: "p.product_id", needs: "p" },
  city: { select: "c.city", group: "c.city", needs: "c" },
  state: { select: "c.state", group: "c.state", needs: "c" },
  segment: { select: "c.segment", group: "c.segment", needs: "c" },
  customer: { select: "c.name AS customer", group: "c.customer_id", needs: "c" },
  payment: { select: "o.payment_method", group: "o.payment_method", needs: "o" },
  status: { select: "o.status", group: "o.status", needs: "o" },
  month: { select: "substr(DATE, 1, 7) AS month", group: "month", needs: "date" },
  year: { select: "substr(DATE, 1, 4) AS year", group: "year", needs: "date" },
};
const FILTER_ALIAS: Record<keyof Vocab, string> = {
  category: "p.category", brand: "p.brand", product_name: "p.product_name", city: "c.city", state: "c.state",
  segment: "c.segment", payment_method: "o.payment_method", status: "o.status",
};

export function plan(question: string): Plan {
  const original = question.trim();
  const q = original.toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/g, "").replace(/\s+/g, " ")
    .replace(/\bproduct (categor(y|ies)|brands?)\b/g, "$1").replace(/\bcustomer (cit(y|ies)|states?|segments?)\b/g, "$1");
  if (unknownName(original)) return { kind: "pass", reason: "a name the planner doesn't know" };
  const special = specialCases(q);
  if (special) return special;
  const metric = findMetric(q);
  const dim = findDim(q);
  const filters = findFilters(q, original);
  const period = findPeriod(q);
  const share = /\bshare\b|percent(age)?|proportion|\bpct\b|%/.test(q) && !/rate/.test(q);
  const ranking = /\b(top|best|worst|bottom|highest|lowest|most|least|largest|biggest|smallest|fewest|maximum|minimum|leading|cheapest|priciest|expensive)\b/.test(q);
  const ascending = /\b(worst|bottom|lowest|least|smallest|fewest|minimum|cheapest)\b/.test(q);

  // vague questions: ask back
  if (!metric && (ranking || /how (are|is) (we|it|the business|business) doing|performance|growth|numbers|figures|kpis?|stats/.test(q)))
    return { kind: "clarify", question: ranking
      ? "Best by what: revenue, units sold or number of orders? And over which period?"
      : "Which number would help: revenue, orders, average order value or return rate? And for which period?" };
  if (!metric) return { kind: "pass", reason: "no metric" };
  if (/\b(numbers|figures|stats)\b/.test(q) && !period && !dim && !filters.length)
    return { kind: "clarify", question: "For which period (e.g. last month, 2026), and broken down by what (category, city, month)?" };
  if (period === "future") return { kind: "clarify", question: "The data covers 1 Jan 2025 to 30 Sep 2026. Which period in that range should I use?" };
  if (period === "two" || TOO_COMPLEX.test(q)) {
    // "compare revenue from Business and Consumer customers" = a breakdown, which the planner can do
    const multi = filters.find((f) => f.values.length > 1);
    if (!(period !== "two" && /\b(compare|vs\.?|versus)\b/.test(q) && multi && !/growth|grew|change|increase|decrease|more than|less than|never/.test(q)))
      return { kind: "pass", reason: "comparison or condition" };
  }

  // a filter with several values of the same field ("Business and Consumer") becomes the breakdown
  let breakdown: Dim | null = dim;
  const multiFilter = filters.find((f) => f.values.length > 1);
  if (!breakdown && multiFilter) {
    const map: Partial<Record<keyof Vocab, Dim>> = { category: "category", brand: "brand", product_name: "product", city: "city", state: "state", segment: "segment", payment_method: "payment", status: "status" };
    breakdown = map[multiFilter.field] ?? null;
  }
  // the metric word itself is not a breakdown ("which customers" when counting customers is fine as a breakdown only with another metric)
  if (breakdown === "customer" && (metric === "customers" || metric === "signups")) breakdown = null;
  if (breakdown === "product" && (metric === "products")) breakdown = null;

  // ---------- products table questions ----------
  if (metric === "products" || metric === "price") {
    if (filters.some((f) => !["category", "brand", "product_name"].includes(f.field)) || period) return { kind: "pass", reason: "product filters" };
    const where = filters.map((f) => `${FILTER_ALIAS[f.field]} IN (${f.values.map((v) => `'${esc(v)}'`).join(", ")})`);
    const W = where.length ? `\nWHERE ${where.join(" AND ")}` : "";
    if (metric === "price" && (ranking || /which|what (is|are) the/.test(q))) {
      const n = findLimit(q) ?? (/(products|items)\b/.test(q) ? 5 : 1);
      return { kind: "sql", sql: `SELECT p.product_name, p.category, p.list_price_inr\nFROM products p${W}\nORDER BY p.list_price_inr ${ascending ? "ASC" : "DESC"}\nLIMIT ${n}` };
    }
    const value = metric === "price" ? "ROUND(AVG(p.list_price_inr), 2) AS avg_list_price_inr" : "COUNT(*) AS products";
    if (breakdown && ["category", "brand"].includes(breakdown))
      return { kind: "sql", sql: `SELECT p.${breakdown}, ${value}\nFROM products p${W}\nGROUP BY p.${breakdown}\nORDER BY 2 DESC` };
    return breakdown ? { kind: "pass", reason: "product breakdown" } : { kind: "sql", sql: `SELECT ${value}\nFROM products p${W}` };
  }

  // ---------- customers table questions (no orders involved) ----------
  const orderFilters = filters.some((f) => ["category", "brand", "product_name", "payment_method", "status"].includes(f.field));
  if (metric === "signups" || (metric === "customers" && !period && !orderFilters && !/order|bought|purchas|active|spen[dt]|revenue|sales/.test(q))) {
    if (orderFilters || (breakdown && !["city", "state", "segment", "month", "year"].includes(breakdown))) return { kind: "pass", reason: "customer breakdown" };
    if (metric === "customers" && breakdown && ["month", "year"].includes(breakdown)) return { kind: "pass", reason: "customers over time" };
    const where = filters.map((f) => `${FILTER_ALIAS[f.field]} IN (${f.values.map((v) => `'${esc(v)}'`).join(", ")})`);
    if (period && metric === "signups") where.push(`c.signup_date BETWEEN '${period.from}' AND '${period.to}'`);
    const W = where.length ? `\nWHERE ${where.join(" AND ")}` : "";
    const value = metric === "signups" ? "COUNT(*) AS new_customers" : "COUNT(*) AS customers";
    if (!breakdown) return { kind: "sql", sql: `SELECT ${value}\nFROM customers c${W}` };
    const d = DIM_SQL[breakdown];
    const sel = d.select.replace("DATE", "c.signup_date");
    const order = d.needs === "date" ? `ORDER BY ${d.group}` : `ORDER BY 2 ${ascending ? "ASC" : "DESC"}`;
    const n = findLimit(q) ?? (ranking && /\b(which|what)\b/.test(q) ? 1 : null);
    return { kind: "sql", sql: `SELECT ${sel}, ${value}\nFROM customers c${W}\nGROUP BY ${d.group}\n${order}${n ? `\nLIMIT ${n}` : ""}` };
  }

  // ---------- order questions ----------
  const needsP = breakdown && DIM_SQL[breakdown].needs === "p" || filters.some((f) => ["category", "brand", "product_name"].includes(f.field));
  const needsC = breakdown && DIM_SQL[breakdown].needs === "c" || filters.some((f) => ["city", "state", "segment"].includes(f.field));
  const lineMetric = ["revenue", "units", "aov", "discount"].includes(metric);
  const needsItems = lineMetric || needsP;
  if (metric === "delivery" && needsP) return { kind: "pass", reason: "delivery by product" };

  const from = [needsItems ? "FROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id" : "FROM orders o"];
  if (needsP) from.push("JOIN products p ON p.product_id = oi.product_id");
  if (needsC) from.push("JOIN customers c ON c.customer_id = o.customer_id");

  const statusFilter = filters.find((f) => f.field === "status");
  const where: string[] = [];
  if (["revenue", "units", "aov"].includes(metric)) where.push(VALID);
  if (metric === "delivery") where.push("o.status = 'delivered'");
  for (const f of filters) {
    if (f === statusFilter && (["revenue", "units", "aov", "delivery", "cancel_rate", "return_rate"].includes(metric) || share)) continue;
    if (f === multiFilter && breakdown && share) continue;
    where.push(`${FILTER_ALIAS[f.field]} IN (${f.values.map((v) => `'${esc(v)}'`).join(", ")})`);
  }
  if (period) where.push(`o.order_date BETWEEN '${period.from}' AND '${period.to}'`);

  const REV = `SUM(${LINE})`;
  const ORD = "COUNT(DISTINCT o.order_id)";
  const VALUE: Record<string, string> = {
    revenue: `ROUND(${REV}, 2) AS revenue_inr`,
    units: "SUM(oi.quantity) AS units_sold",
    aov: `ROUND(${REV} / ${ORD}, 2) AS avg_order_value_inr`,
    orders: `${ORD} AS orders`,
    customers: "COUNT(DISTINCT o.customer_id) AS customers",
    discount: "ROUND(AVG(oi.discount_pct), 2) AS avg_discount_pct",
    delivery: "ROUND(AVG(julianday(o.delivery_date) - julianday(o.order_date)), 2) AS avg_delivery_days",
    cancel_rate: `ROUND(100.0 * COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.order_id END) / ${ORD}, 2) AS cancellation_rate_pct`,
    return_rate: `ROUND(100.0 * COUNT(DISTINCT CASE WHEN o.status = 'returned' THEN o.order_id END) / COUNT(DISTINCT CASE WHEN o.status != 'cancelled' THEN o.order_id END), 2) AS return_rate_pct`,
  };
  let value = VALUE[metric];

  // "what share of revenue comes from Electronics" / "% of orders paid by UPI" / "% of orders cancelled"
  if (share && ["revenue", "units", "orders"].includes(metric)) {
    const target = (breakdown ? null : filters.find((f) => f !== undefined && (f.field !== "status" || metric === "orders")));
    if (!breakdown && target) {
      const idx = where.indexOf(`${FILTER_ALIAS[target.field]} IN (${target.values.map((v) => `'${esc(v)}'`).join(", ")})`);
      if (idx >= 0) where.splice(idx, 1);
      const cond = `${FILTER_ALIAS[target.field]} IN (${target.values.map((v) => `'${esc(v)}'`).join(", ")})`;
      value = metric === "orders" ? `ROUND(100.0 * COUNT(DISTINCT CASE WHEN ${cond} THEN o.order_id END) / ${ORD}, 2) AS share_pct`
        : `ROUND(100.0 * SUM(CASE WHEN ${cond} THEN ${metric === "units" ? "oi.quantity" : LINE} END) / ${metric === "units" ? "SUM(oi.quantity)" : REV}, 2) AS share_pct`;
      return { kind: "sql", sql: `SELECT ${value}\n${from.join("\n")}${where.length ? `\nWHERE ${where.join("\n  AND ")}` : ""}` };
    }
    if (!breakdown) return { kind: "pass", reason: "share of what" };
  }

  const W = where.length ? `\nWHERE ${where.join("\n  AND ")}` : "";
  if (!breakdown) return { kind: "sql", sql: `SELECT ${value}\n${from.join("\n")}${W}` };

  const d = DIM_SQL[breakdown];
  const sel = d.select.replace("DATE", "o.order_date");
  const valueName = value.split(" AS ").pop()!;
  const raw = value.split(" AS ")[0].replace(/^ROUND\((.*), 2\)$/, "$1");
  const shareCol = share && ["revenue", "units", "orders"].includes(metric) ? `,\n       ROUND(100.0 * ${raw} / SUM(${raw}) OVER (), 2) AS share_pct` : "";
  const isTime = d.needs === "date";
  const n = findLimit(q) ?? (ranking && !isTime ? (/\b(products|customers|cities|brands|categories|states|items|methods|segments|months)\b/.test(q) ? 5 : 1) : null);
  const order = isTime ? `ORDER BY ${d.group}` : `ORDER BY ${valueName} ${ascending ? "ASC" : "DESC"}`;
  return { kind: "sql", sql: `SELECT ${sel}, ${value}${shareCol}\n${from.join("\n")}${W}\nGROUP BY ${d.group}\n${order}${n && !isTime ? `\nLIMIT ${n}` : ""}` };
}

// ---------- a few common question shapes that need a subquery or two periods ----------
function periodsIn(q: string): Array<{ label: string; p: Period }> {
  const out: Array<{ label: string; p: Period }> = [];
  for (const m of q.matchAll(/\bq([1-4])\s*(?:of\s*)?(20\d\d)\b/g)) out.push({ label: `q${m[1]}_${m[2]}`, p: monthRange(Number(m[2]), Number(m[1]) * 3 - 2, Number(m[1]) * 3) });
  if (out.length < 2) {
    out.length = 0;
    for (const m of q.matchAll(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20\d\d)\b/g)) out.push({ label: `${m[1].slice(0, 3)}_${m[2]}`, p: monthRange(Number(m[2]), MONTHS.indexOf(m[1].slice(0, 3)) + 1) });
  }
  const years = [...new Set([...q.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1])))];
  const oneQuarter = q.match(/\bq([1-4])\b/);
  const oneMonth = q.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (out.length < 2 && years.length === 2 && (oneQuarter || oneMonth)) {
    out.length = 0;
    for (const y of years) {
      if (oneQuarter) out.push({ label: `q${oneQuarter[1]}_${y}`, p: monthRange(y, Number(oneQuarter[1]) * 3 - 2, Number(oneQuarter[1]) * 3) });
      else out.push({ label: `${oneMonth![1].slice(0, 3)}_${y}`, p: monthRange(y, MONTHS.indexOf(oneMonth![1].slice(0, 3)) + 1) });
    }
  }
  if (out.length < 2) {
    out.length = 0;
    for (const m of q.matchAll(/\b(20\d\d)\b/g)) out.push({ label: `y${m[1]}`, p: { from: `${m[1]}-01-01`, to: `${m[1]}-12-31` } });
  }
  const unique = out.filter((x, i) => out.findIndex((y) => y.label === x.label) === i);
  return unique.length === 2 ? unique.sort((a, b) => a.p.from.localeCompare(b.p.from)) : [];
}

function specialCases(q: string): Plan | null {
  const n = (s: string) => Number(s) || NUM[s];
  if (/(customers?|buyers).*\bnever\b.*(order|bought|purchas)/.test(q))
    return { kind: "sql", sql: "SELECT COUNT(*) AS customers_without_orders\nFROM customers\nWHERE customer_id NOT IN (SELECT customer_id FROM orders)" };
  if (/products?.*\bnever\b.*(order|sold|bought)/.test(q))
    return { kind: "sql", sql: "SELECT COUNT(*) AS products_never_ordered\nFROM products\nWHERE product_id NOT IN (SELECT product_id FROM order_items)" };
  const m = q.match(/(?:how many|number of) customers.*\b(more than|over|at least|fewer than|less than)\s+(\d+|\w+) orders/);
  if (m && n(m[2])) {
    const op = { "more than": ">", over: ">", "at least": ">=", "fewer than": "<", "less than": "<" }[m[1]]!;
    return { kind: "sql", sql: `SELECT COUNT(*) AS customers\nFROM (\n  SELECT customer_id\n  FROM orders\n  GROUP BY customer_id\n  HAVING COUNT(*) ${op} ${n(m[2])}\n)` };
  }
  if (/(how many|number of) orders.*(more than one|multiple|several|2 or more|two or more) (products?|items?)/.test(q))
    return { kind: "sql", sql: "SELECT COUNT(*) AS orders_with_several_products\nFROM (\n  SELECT order_id\n  FROM order_items\n  GROUP BY order_id\n  HAVING COUNT(*) > 1\n)" };
  if (/average (number of )?(units|items|products) per (valid )?order|units per order/.test(q))
    return { kind: "sql", sql: `SELECT ROUND(1.0 * SUM(oi.quantity) / COUNT(DISTINCT o.order_id), 2) AS avg_units_per_order\nFROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id\nWHERE ${VALID}` };

  // growth / comparison of one metric between two periods: "revenue growth Q3 2026 vs Q3 2025"
  const two = /\b(vs\.?|versus|compared?|comparison|against|growth|grow|grew|change|increase|decrease|difference)\b/.test(q) ? periodsIn(q) : [];
  const metric = findMetric(q);
  if (two.length === 2 && metric && ["revenue", "orders", "units", "aov"].includes(metric) && !findDim(q) && !findFilters(q, q).length) {
    const inP = (p: Period) => `o.order_date BETWEEN '${p.from}' AND '${p.to}'`;
    const rev = (p: Period) => `SUM(CASE WHEN ${inP(p)} THEN ${LINE} END)`;
    const ord = (p: Period) => `COUNT(DISTINCT CASE WHEN ${inP(p)} THEN o.order_id END)`;
    const expr = (p: Period) => metric === "revenue" ? rev(p) : metric === "orders" ? ord(p)
      : metric === "units" ? `SUM(CASE WHEN ${inP(p)} THEN oi.quantity END)` : `${rev(p)} / ${ord(p)}`;
    const unit = metric === "revenue" ? "revenue" : metric === "aov" ? "aov" : metric === "units" ? "units" : "orders";
    const money = metric === "revenue" || metric === "aov" ? "_inr" : "";
    const [a, b] = two;
    const from = metric === "orders" ? "FROM orders o" : "FROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id";
    const where = metric === "orders" ? "" : `\nWHERE ${VALID}`;
    return { kind: "sql", sql: `SELECT ROUND(${expr(a.p)}, 2) AS ${unit}_${a.label}${money},\n       ROUND(${expr(b.p)}, 2) AS ${unit}_${b.label}${money},\n       ROUND(100.0 * (1.0 * ${expr(b.p)} / ${expr(a.p)} - 1), 2) AS growth_pct\n${from}${where}` };
  }
  return null;
}

// Capitalised words the planner doesn't recognise (e.g. a customer's name) mean it can't be sure what is asked.
const KNOWN = new Set(["i", "upi", "aov", "gmv", "cod", "b2b", "b2c", "kpi", "kpis", "ytd", "q1", "q2", "q3", "q4", "diwali", "india", "indian", "inr", "rs", "sql",
  ...MONTHS, "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december"]);
function unknownName(original: string): boolean {
  const known = new Set([...KNOWN, ...Object.values(VOCAB).flat().flatMap((v) => v.toLowerCase().split(/[\s&]+/))]);
  const words = original.replace(/[^A-Za-z0-9&\s'-]/g, " ").split(/\s+/).filter(Boolean);
  return words.slice(1).some((w) => /^[A-Z][a-z]/.test(w) && !known.has(w.toLowerCase()));
}
