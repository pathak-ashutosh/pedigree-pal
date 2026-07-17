"use client";

import { useActionState } from "react";
import { archiveDog } from "@/app/actions/dogs";
import { initialDogState, type DogActionState } from "@/lib/dogs/state";
import styles from "../dogs.module.css";

export function ArchiveForm({ organizationSlug, dogId }: { organizationSlug: string; dogId: string }) {
  const [state, formAction, pending] = useActionState(archiveDog, initialDogState);
  return (
    <ArchiveFields
      dogId={dogId}
      formAction={formAction}
      organizationSlug={organizationSlug}
      pending={pending}
      state={state}
    />
  );
}

export function ArchiveFields({
  organizationSlug,
  dogId,
  state,
  formAction,
  pending,
}: {
  organizationSlug: string;
  dogId: string;
  state: DogActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className={styles.archiveForm}>
      <input name="organizationSlug" type="hidden" value={organizationSlug} />
      <input name="dogId" type="hidden" value={dogId} />
      <div>
        <strong>Archive this record</strong>
        <p>It leaves active views but remains in the audit history.</p>
      </div>
      <button disabled={pending} type="submit">{pending ? "Archiving…" : "Archive dog"}</button>
      <p className={styles.error} role="status">{state.message}</p>
    </form>
  );
}
