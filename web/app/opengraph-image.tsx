// The preview card shown when the link is shared on LinkedIn, WhatsApp, X or Slack (1200 x 630).
// Built from the latest test results, so the numbers on the card match the site.
import { ImageResponse } from "next/og";
import report from "@/public/data/eval.json";
import type { Report } from "@/lib/types";
import tables from "@/public/data/tables.json";

export const alt = "AI Data Analyst Agent: ask a question, get the SQL, the answer and the chart. A read-only, self-correcting text-to-SQL agent.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const s = (report as unknown as Report).summary;
  const stats = s
    ? [
        [`${Math.round(s.execution_accuracy_pct)}%`, "execution accuracy"],
        [`${s.questions}`, "test questions"],
        [`${s.fixed_by_retry}`, "fixed its own error"],
        ["0", "writes allowed"],
      ]
    : [["40", "test questions"], ["0", "writes allowed"]];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#0b1414", color: "#f2f4f8", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="52" height="52" viewBox="2 2 28 28">
            <path d="M8 14.5V10.5A8 8 0 0 1 24 10.5V14.5H19.5V10.5A3.5 3.5 0 0 0 12.5 10.5V14.5Z" fill="#43d6a6" />
            <path d="M5.75 15.5a1.5 1.5 0 0 1 1.5-1.5H24.25a1.5 1.5 0 0 1 1.5 1.5V17.4c0 1.7-4.5 2.6-10.75 2.6S5.75 19.1 5.75 17.4Z" fill="#43d6a6" />
            <path d="M5.75 23.5a1.5 1.5 0 0 1 1.5-1.5H24.25a1.5 1.5 0 0 1 1.5 1.5V25.4c0 1.7-4.5 2.6-10.75 2.6S5.75 27.1 5.75 25.4Z" fill="#f2a93b" />
          </svg>
          <div style={{ fontSize: 38, fontWeight: 600 }}>AI Data Analyst Agent</div>
          <div style={{ fontSize: 26, color: "#aab3c5", marginLeft: 6 }}>text-to-SQL · read-only · self-correcting</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
            Ask the data a question. Get the SQL, the answer and the chart.
          </div>
          <div style={{ fontSize: 28, color: "#aab3c5" }}>{`An Indian online shop's database: ${tables.orders.rows.toLocaleString("en-IN")} orders, every answer shows its SQL`}</div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {stats.map(([v, l]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", padding: "14px 22px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)" }}>
              <div style={{ fontSize: 40, fontWeight: 600, color: "#7ee8c3" }}>{v}</div>
              <div style={{ fontSize: 22, color: "#aab3c5" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
