// The headline numbers from the latest 40-question test
import type { Summary } from "@/lib/types";

export default function Kpis({ s }: { s: Summary | null }) {
  const items = s ? [
    { label: "execution accuracy", value: `${Math.round(s.execution_accuracy_pct)}%` },
    { label: "right on the first try", value: `${Math.round(s.first_try_pct)}%` },
    { label: "fixed its own error", value: String(s.fixed_by_retry) },
    { label: "vague questions asked back", value: s.vague_asked_back.replace(" of ", "/") },
  ] : [
    { label: "test questions", value: "40" }, { label: "tables", value: "4" },
    { label: "max self-fixes", value: "2" }, { label: "writes allowed", value: "0" },
  ];
  return (
    <dl className="kpis">
      {items.map((k) => <div className="kpi" key={k.label}><dt>{k.label}</dt><dd>{k.value}</dd></div>)}
    </dl>
  );
}
