import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { OrganizationForm } from "./organization-form";
import styles from "./onboarding.module.css";

export const metadata: Metadata = { title: "Create workspace" };

export default async function OnboardingPage() {
  await requireUser();

  return (
    <main className={styles.page}>
      <header>
        <Link href="/">PP / PedigreePal</Link>
        <span>Workspace setup · 01</span>
      </header>
      <section>
        <div className={styles.copy}>
          <p>Start the record</p>
          <h1>Name your organization workspace.</h1>
          <p>
            This creates the private tenant boundary for dogs, pedigree links,
            documents, team access, billing, and audit history.
          </p>
        </div>
        <OrganizationForm />
      </section>
      <footer>Private by default · change history retained · owner role assigned automatically</footer>
    </main>
  );
}
