// Shown for any address that doesn't exist (Next.js still sends a 404 status and noindex).
import Link from "next/link";
import { HUB_URL } from "@/lib/seo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingTop: 48 }}>
      <h1>This page doesn&apos;t exist.</h1>
      <p className="lead-plain">The address may be mistyped, or the page has moved. Try one of these:</p>
      <ul className="list-plain">
        <li><Link href="/">Ask the agent a question</Link></li>
        <li><Link href="/how-it-works">How the text-to-SQL agent works</Link></li>
        <li><Link href="/results">Test results on 40 questions</Link></li>
        <li><Link href="/playground">SQL playground</Link></li>
        <li><a href={HUB_URL}>Other projects by Aditya Khetarpal</a></li>
      </ul>
    </div>
  );
}
