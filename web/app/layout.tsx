// The frame around every page: fonts, header with menu, footer with name and links
import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono"; // numbers, labels and SQL
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "AI Data Analyst Agent",
  description: "Ask business questions in plain English. A read-only AI agent writes the SQL, checks it, fixes its own errors and answers with a table and chart.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="site-name"><span className="site-mark" aria-hidden="true">SQL</span>Data Analyst<span className="name-accent">Agent</span></Link>
            <Nav />
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap footer-row">
            <p className="footer-by">Built by <strong>Aditya Khetarpal</strong></p>
            <nav className="footer-links" aria-label="Aditya Khetarpal elsewhere">
              <a href="https://github.com/AdityaKhetarpal" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://www.linkedin.com/in/adityakhetarpal" target="_blank" rel="noreferrer">LinkedIn</a>
              <a href="https://github.com/AdityaKhetarpal/ai-data-analyst-agent" target="_blank" rel="noreferrer">Source code</a>
            </nav>
          </div>
          <div className="wrap">
            <p className="footer-note">
              The shop and its data are generated sample data (fixed random seed), made for this project. The agent can only read the database, never change it.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
