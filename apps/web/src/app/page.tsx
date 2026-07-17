import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import styles from "./page.module.css";

const workflow = [
  {
    number: "01",
    title: "Build the record",
    body: "Capture lineage, ownership, health references, and source documents in one private workspace.",
  },
  {
    number: "02",
    title: "Review with your team",
    body: "Give owners, staff, and collaborators only the access their role requires.",
  },
  {
    number: "03",
    title: "Publish proof selectively",
    body: "Share a durable verification record without exposing private operational data.",
  },
];

function BrandMark() {
  return <BrandLogo className={styles.brandMark} />;
}

export default function Home() {
  return (
    <div className={styles.siteShell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="PedigreePal home">
          <BrandMark />
          <span>PedigreePal</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#trust">Trust layer</a>
          <Link className={styles.navCta} href="/login" prefetch={false}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Registry-grade records · human-scale workflow</p>
            <h1>Every pedigree should hold up under scrutiny.</h1>
            <p className={styles.lede}>
              PedigreePal gives breeding organizations a clear system for lineage,
              ownership, team review, and optional public proof.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/login" prefetch={false}>
                Create your workspace
                <span aria-hidden="true">→</span>
              </Link>
              <a className={styles.textLink} href="#workflow">
                See the workflow
              </a>
            </div>
          </div>

          <div className={styles.registryCard} aria-label="Example three-generation pedigree">
            <div className={styles.cardHeader}>
              <div>
                <p>Registry preview</p>
                <h2>Northstar Juniper</h2>
              </div>
              <span className={styles.registryId}>PP–2048</span>
            </div>
            <div className={styles.lineageMap}>
              <div className={`${styles.dogNode} ${styles.focusDog}`}>
                <span>Subject</span>
                <strong>Juniper</strong>
                <small>Golden Retriever</small>
              </div>
              <div className={styles.connector} aria-hidden="true" />
              <div className={styles.parentColumn}>
                <div className={`${styles.dogNode} ${styles.sireNode}`}>
                  <span>Sire</span>
                  <strong>Orion</strong>
                  <small>PP–1832</small>
                </div>
                <div className={`${styles.dogNode} ${styles.damNode}`}>
                  <span>Dam</span>
                  <strong>Marigold</strong>
                  <small>PP–1756</small>
                </div>
              </div>
              <div className={styles.grandparentTicks} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className={styles.cardFooter}>
              <span>
                <i className={styles.statusDot} /> Record ready for review
              </span>
              <span>Updated 12 Jul</span>
            </div>
          </div>
        </section>

        <section className={styles.proofStrip} id="trust" aria-label="Product principles">
          <p><span>01</span><strong>Private by default</strong> Operational records stay inside the organization.</p>
          <p><span>02</span><strong>Evidence attached</strong> Decisions retain their source and audit trail.</p>
          <p><span>03</span><strong>Proof is optional</strong> Blockchain supports verification; it never runs the workspace.</p>
        </section>

        <section className={styles.workflow} id="workflow">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>One durable record</p>
            <h2>From kennel notes to credible proof.</h2>
            <p>
              Keep the daily work simple while preserving the structure needed for
              long-term stewardship.
            </p>
          </div>
          <div className={styles.workflowGrid}>
            {workflow.map((step) => (
              <article className={styles.workflowCard} key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.closingCta}>
          <div>
            <p className={styles.eyebrow}>Built for responsible programs</p>
            <h2>Your records deserve more than a spreadsheet.</h2>
          </div>
          <Link className={styles.lightButton} href="/login" prefetch={false}>
            Start with PedigreePal <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/">
          <BrandMark />
          <span>PedigreePal</span>
        </Link>
        <p>Open source under GPL-3.0-only.</p>
      </footer>
    </div>
  );
}
