import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Link className={styles.back} href="/">
          ← PedigreePal
        </Link>
        <div className={styles.copy}>
          <p>Organization access</p>
          <h1>Welcome to the record room.</h1>
          <p>
            Sign in to manage private pedigree records, review changes, and coordinate
            your team.
          </p>
        </div>
        <LoginForm />
      </section>
      <aside className={styles.aside} aria-label="PedigreePal trust principles">
        <p>PP / ACCESS</p>
        <blockquote>“Clear provenance starts with clear stewardship.”</blockquote>
        <ul>
          <li>Private organization workspace</li>
          <li>Role-based team access</li>
          <li>Traceable record changes</li>
        </ul>
      </aside>
    </main>
  );
}
