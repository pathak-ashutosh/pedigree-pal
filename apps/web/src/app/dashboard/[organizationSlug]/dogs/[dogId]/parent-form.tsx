"use client";

import { useActionState } from "react";
import { setDogParent } from "@/app/actions/dogs";
import { initialDogState, type DogActionState } from "@/lib/dogs/state";
import styles from "../dogs.module.css";

export type ParentCandidate = { id: string; registeredName: string };

export function ParentForm({
  organizationSlug,
  childId,
  kind,
  currentParent,
  candidates,
}: {
  organizationSlug: string;
  childId: string;
  kind: "sire" | "dam";
  currentParent?: ParentCandidate;
  candidates: ParentCandidate[];
}) {
  const [state, formAction, pending] = useActionState(setDogParent, initialDogState);
  return (
    <ParentFields
      candidates={candidates}
      childId={childId}
      currentParent={currentParent}
      formAction={formAction}
      kind={kind}
      organizationSlug={organizationSlug}
      pending={pending}
      state={state}
    />
  );
}

export function ParentFields({
  organizationSlug,
  childId,
  kind,
  currentParent,
  candidates,
  state,
  formAction,
  pending,
}: {
  organizationSlug: string;
  childId: string;
  kind: "sire" | "dam";
  currentParent?: ParentCandidate;
  candidates: ParentCandidate[];
  state: DogActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className={styles.parentForm}>
      <input name="organizationSlug" type="hidden" value={organizationSlug} />
      <input name="childId" type="hidden" value={childId} />
      <input name="kind" type="hidden" value={kind} />
      <div>
        <span>{kind}</span>
        <strong>{currentParent?.registeredName ?? "Not assigned"}</strong>
      </div>
      <select aria-label={`Select ${kind}`} defaultValue={currentParent?.id ?? ""} name="parentId" required>
        <option disabled value="">Choose eligible {kind}</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>{candidate.registeredName}</option>
        ))}
      </select>
      <button disabled={pending || candidates.length === 0} type="submit">
        {pending ? "Saving…" : `Save ${kind}`}
      </button>
      <p className={state.status === "error" ? styles.error : styles.status} role="status">
        {state.message}
      </p>
    </form>
  );
}
