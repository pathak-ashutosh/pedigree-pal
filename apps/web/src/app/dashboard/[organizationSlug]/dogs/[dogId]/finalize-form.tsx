"use client";

import { useActionState } from "react";
import { finalizeDogRecord } from "@/app/actions/dogs";
import { initialDogState, type DogActionState } from "@/lib/dogs/state";
import styles from "../dogs.module.css";

export function FinalizeForm({
  organizationSlug,
  dogId,
  recordVersion,
}: {
  organizationSlug: string;
  dogId: string;
  recordVersion: number;
}) {
  const [state, formAction, pending] = useActionState(finalizeDogRecord, initialDogState);
  return (
    <FinalizeFields
      dogId={dogId}
      formAction={formAction}
      organizationSlug={organizationSlug}
      pending={pending}
      recordVersion={recordVersion}
      state={state}
    />
  );
}

export function FinalizeFields({
  organizationSlug,
  dogId,
  recordVersion,
  state,
  formAction,
  pending,
}: {
  organizationSlug: string;
  dogId: string;
  recordVersion: number;
  state: DogActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className={styles.archiveForm}>
      <input name="organizationSlug" type="hidden" value={organizationSlug} />
      <input name="dogId" type="hidden" value={dogId} />
      <div>
        <strong>Finalize version {recordVersion}</strong>
        <p>Freezes the record and queues its fingerprint for attestation. Later edits create a new version.</p>
      </div>
      <button disabled={pending} type="submit">{pending ? "Finalizing…" : "Finalize record"}</button>
      <p className={state.status === "error" ? styles.error : styles.help} role="status">
        {state.message}
      </p>
    </form>
  );
}
