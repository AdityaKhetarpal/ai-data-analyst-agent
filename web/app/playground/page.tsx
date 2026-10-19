// SQL playground: run your own queries on the same database, inside the browser
import type { Metadata } from "next";
import Playground from "@/components/Playground";
import tables from "@/public/data/tables.json";

export const metadata: Metadata = { title: "SQL playground · AI Data Analyst Agent" };

export default function PlaygroundPage() {
  return (
    <>
      <section className="hero"><div className="wrap">
        <p className="eyebrow-chip">sql.js · SQLite in your browser</p>
        <h1>Write the SQL yourself.</h1>
        <p className="lead">The same database the agent uses, loaded into this page. Check the agent&apos;s answers, or try to break it: the same safety check blocks anything that isn&apos;t a SELECT.</p>
      </div></section>
      <div className="wrap"><Playground tables={tables} /></div>
    </>
  );
}
