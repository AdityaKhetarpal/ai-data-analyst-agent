// Home: ask a question (live with an AI key, otherwise browse the agent's real test runs)
import AskPanel from "@/components/AskPanel";
import Kpis from "@/components/Kpis";
import PipelineStrip from "@/components/PipelineStrip";
import report from "@/public/data/eval.json";
import type { Report } from "@/lib/types";

export default function Home() {
  const r = report as unknown as Report;
  return (
    <>
      <section className="hero"><div className="wrap">
        <p className="eyebrow-chip">text-to-SQL agent · read-only · self-correcting</p>
        <h1>Ask the data a question. Get the SQL, the answer and the chart.</h1>
        <p className="lead">
          An AI agent for an Indian online shop&apos;s database (12,000 orders, Jan 2025 to Sep 2026). It writes the SQL,
          <strong> checks it is safe</strong>, runs it on a <strong>read-only</strong> copy, <strong>fixes its own errors</strong>,
          and asks you back when a question is too vague. Every answer shows the exact SQL, so you can check it.
        </p>
        <Kpis s={r.summary} />
        <PipelineStrip />
      </div></section>
      <div className="wrap"><AskPanel report={r} /></div>
    </>
  );
}
