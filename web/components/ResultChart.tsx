"use client"; // hover tooltips
// The chart the agent picked: a line for a trend over time, horizontal bars for a comparison. One series, one colour.
import { useState } from "react";
import { fmt, label } from "@/lib/agent";
import type { Chart, Table } from "@/lib/types";

const W = 640;

function nice(max: number) {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}
function short(v: number) {
  const a = Math.abs(v);
  if (a >= 1e7) return (v / 1e7).toFixed(1).replace(/\.0$/, "") + " cr";
  if (a >= 1e5) return (v / 1e5).toFixed(1).replace(/\.0$/, "") + " L";
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function ResultChart({ table, chart }: { table: Table; chart: NonNullable<Chart> }) {
  const [hover, setHover] = useState<number | null>(null);
  const xi = table.columns.indexOf(chart.x), yi = table.columns.indexOf(chart.y);
  const pts = table.rows.map((r) => ({ x: String(r[xi]), y: Number(r[yi]) || 0 }));
  const top = nice(Math.max(...pts.map((p) => p.y)));
  const title = `${label(chart.y)} by ${label(chart.x).toLowerCase()}`;

  if (chart.type === "bar") {
    const sorted = [...pts].sort((a, b) => b.y - a.y).slice(0, 20);
    const rowH = 26, left = 150, right = 70, H = sorted.length * rowH + 8;
    const sx = (v: number) => (v / top) * (W - left - right);
    return (
      <figure className="chart" aria-label={title}>
        <p className="chart-title">{title}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
          {sorted.map((p, i) => (
            <g key={p.x} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <text className="c-label" x={left - 8} y={i * rowH + 17} textAnchor="end">{p.x.length > 22 ? p.x.slice(0, 21) + "…" : p.x}</text>
              <path className={`c-bar${hover !== null && hover !== i ? " dim" : ""}`}
                d={`M${left},${i * rowH + 5} h${Math.max(sx(p.y) - 4, 0)} a4,4 0 0 1 4,4 v8 a4,4 0 0 1 -4,4 h${-Math.max(sx(p.y) - 4, 0)} z`} />
              <text className="c-label" x={left + sx(p.y) + 6} y={i * rowH + 17}>{short(p.y)}</text>
              <rect className="hit" x={0} y={i * rowH} width={W} height={rowH} />
            </g>
          ))}
        </svg>
        {hover !== null && <div className="chart-tip" style={{ left: "60%", top: `calc(${((hover * rowH) / H) * 100}% + 20px)` }}><strong>{sorted[hover].x}</strong>{fmt(sorted[hover].y, chart.y)}</div>}
      </figure>
    );
  }

  const H = 240, l = 52, r = 16, t = 12, b = 28;
  const sx = (i: number) => l + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * (W - l - r));
  const sy = (v: number) => t + (1 - v / top) * (H - t - b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(i)},${sy(p.y)}`).join(" ");
  const every = Math.ceil(pts.length / 8);
  return (
    <figure className="chart" aria-label={title}>
      <p className="chart-title">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - box.left) / box.width) * W;
          setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((x - l) / (W - l - r)) * (pts.length - 1)))));
        }}>
        <g className="grid">{[0, 0.5, 1].map((f) => <line key={f} x1={l} x2={W - r} y1={sy(top * f)} y2={sy(top * f)} />)}</g>
        <g className="axis">
          {[0, 0.5, 1].map((f) => <text key={f} x={l - 6} y={sy(top * f) + 3} textAnchor="end">{short(top * f)}</text>)}
          {pts.map((p, i) => (i % every === 0 || i === pts.length - 1) && <text key={p.x} x={sx(i)} y={H - 8} textAnchor="middle">{p.x}</text>)}
        </g>
        <path className="c-area" d={`${path} L${sx(pts.length - 1)},${sy(0)} L${sx(0)},${sy(0)} Z`} />
        <path className="c-line" d={path} />
        {hover !== null && <line className="c-cross" x1={sx(hover)} x2={sx(hover)} y1={t} y2={H - b} />}
        {hover !== null && <circle className="c-dot" cx={sx(hover)} cy={sy(pts[hover].y)} r={5} />}
        <circle className="c-dot" cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1].y)} r={4} />
      </svg>
      {hover !== null && <div className="chart-tip" style={{ left: `${(sx(hover) / W) * 100}%`, top: 30 }}><strong>{pts[hover].x}</strong>{fmt(pts[hover].y, chart.y)}</div>}
    </figure>
  );
}
