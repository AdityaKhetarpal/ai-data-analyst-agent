// Home: ask a question (live with an AI key, otherwise browse the agent's real test runs)
import Link from "next/link";
import AskPanel from "@/components/AskPanel";
import Kpis from "@/components/Kpis";
import PipelineStrip from "@/components/PipelineStrip";
import report from "@/public/data/eval.json";
import type { Report } from "@/lib/types";
import Faq from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import { agentFaq } from "@/lib/faq";
import { SITE_URL, SITE_NAME, REPO_URL, HUB_URL, PERSON_LD, dateText } from "@/lib/seo";

const summary = (report as unknown as Report).summary;

// What Google shows for this page: the title leads with what people search ("text-to-SQL agent").
export const metadata = {
  title: { absolute: "AI Data Analyst Agent: a self-correcting text-to-SQL agent you can try" },
  description: summary
    ? `Ask business questions in plain English. A read-only text-to-SQL agent writes the SQL, checks it, fixes its own errors and shows a chart. ${Math.round(summary.execution_accuracy_pct)}% execution accuracy on ${summary.questions} test questions.`
    : undefined,
  alternates: { canonical: "/" },
};

// This project as structured data: a free web app by Aditya
const PAGE_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  alternateName: "Text-to-SQL agent demo",
  url: SITE_URL,
  description:
    "A read-only, self-correcting text-to-SQL agent: it turns plain-English business questions into checked SQL, runs it on a read-only database, fixes its own errors and shows the SQL with every answer.",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Text-to-SQL, data analysis",
  operatingSystem: "Any (web browser)",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  dateModified: summary?.run_date,
  author: { "@id": PERSON_LD["@id"] },
  codeRepository: REPO_URL,
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

export default function Home() {
  const r = report as unknown as Report;
  return (
    <>
      <section className="hero"><div className="wrap">
        <p className="eyebrow-chip">text-to-SQL agent · read-only · self-correcting</p>
        <h1>Ask the data a question. Get the SQL, the answer and the chart.</h1>
        <p className="lead">
          An analyst agent for an Indian online shop&apos;s database (12,000 orders, Jan 2025 to Sep 2026). Ask in plain English:
          it writes the SQL, <strong>checks it is safe</strong>, runs it on a <strong>read-only</strong> copy, <strong>fixes its own errors</strong>,
          and asks you back when a question is too vague. Every answer shows the exact SQL, so you can check it.
        </p>
        {r.summary && (
          <p className="byline">
            By <a href={HUB_URL} rel="author">Aditya Khetarpal</a> · Tested <time dateTime={r.summary.run_date}>{dateText(r.summary.run_date)}</time> ·{" "}
            <Link href="/how-it-works">How it works</Link>
          </p>
        )}
        <Kpis s={r.summary} />
        <PipelineStrip />
      </div></section>
      <div className="wrap"><AskPanel /></div>
      <div className="wrap"><Faq items={agentFaq()} title="Text-to-SQL agents: questions people ask" /></div>
      <JsonLd data={PAGE_LD} />
    </>
  );
}
