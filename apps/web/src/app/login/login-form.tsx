"use client";

import { useActionState } from "react";
import { requestMagicLink } from "@/app/actions/auth";
import { initialAuthState, type AuthState } from "@/lib/auth/state";
import styles from "./login.module.css";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialAuthState);

  return <LoginFields state={state} formAction={formAction} pending={pending} />;
}

export function LoginFields({
  state,
  formAction,
  pending,
}: {
  state: AuthState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {

  return (
    <form action={formAction} className={styles.form} noValidate>
      <label htmlFor="email">Work email</label>
      <input
        aria-describedby="email-help auth-status"
        aria-invalid={Boolean(state.errors?.email)}
        autoComplete="email"
        id="email"
        name="email"
        placeholder="you@kennel.org"
        required
        type="email"
      />
      <p className={styles.help} id="email-help">
        We will email a one-time, secure sign-in link.
      </p>
      <button disabled={pending} type="submit">
        {pending ? "Sending…" : "Continue with email"}
        <span aria-hidden="true">→</span>
      </button>
      <p
        className={state.status === "error" ? styles.error : styles.status}
        id="auth-status"
        role="status"
      >
        {state.message}
      </p>
    </form>
  );
}
