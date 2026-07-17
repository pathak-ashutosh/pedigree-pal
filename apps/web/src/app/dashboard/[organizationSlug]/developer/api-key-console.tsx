"use client";

import { useActionState } from "react";
import { createApiKey, revokeApiKey } from "@/app/actions/api-keys";
import { initialApiKeyState } from "@/lib/api/state";
import styles from "./developer.module.css";

export type ApiKeySummary = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function RevokeKey({ organizationSlug, keyId }: { organizationSlug: string; keyId: string }) {
  const [state, action, pending] = useActionState(revokeApiKey, initialApiKeyState);
  return (
    <form action={action} className={styles.revokeForm}>
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <input type="hidden" name="keyId" value={keyId} />
      <button type="submit" disabled={pending}>{pending ? "Revoking…" : "Revoke"}</button>
      {state.message ? <small role={state.status === "error" ? "alert" : "status"}>{state.message}</small> : null}
    </form>
  );
}

export function ApiKeyConsole({
  organizationSlug,
  apiKeys,
}: {
  organizationSlug: string;
  apiKeys: ApiKeySummary[];
}) {
  const [state, action, pending] = useActionState(createApiKey, initialApiKeyState);

  return (
    <div className={styles.keyConsole}>
      <form action={action} className={styles.createForm}>
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <label htmlFor="key-name">New read-only key</label>
        <div>
          <input id="key-name" name="name" minLength={2} maxLength={80} required placeholder="Production integration" />
          <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create key"}</button>
        </div>
        {state.message ? <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
        {state.key ? <code className={styles.rawKey}>{state.key}</code> : null}
      </form>

      <ul className={styles.keyList}>
        {apiKeys.map((key) => (
          <li key={key.id}>
            <div>
              <strong>{key.name}</strong>
              <code>{key.key_prefix}…</code>
            </div>
            <span>{key.scopes.join(", ")}</span>
            <time dateTime={key.last_used_at ?? key.created_at}>
              {key.last_used_at ? "used " : "created "}
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                new Date(key.last_used_at ?? key.created_at),
              )}
            </time>
            {key.revoked_at ? <em>revoked</em> : <RevokeKey organizationSlug={organizationSlug} keyId={key.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
