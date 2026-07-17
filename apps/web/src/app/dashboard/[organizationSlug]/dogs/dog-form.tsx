"use client";

import { useActionState } from "react";
import { createDog, updateDog } from "@/app/actions/dogs";
import { initialDogState, type DogActionState } from "@/lib/dogs/state";
import styles from "./dogs.module.css";

export type DogFormDefaults = {
  id?: string;
  registeredName?: string;
  callName?: string | null;
  breed?: string;
  sex?: "male" | "female" | "unknown";
  birthDate?: string;
  notes?: string | null;
  hasMicrochip?: boolean;
};

export function DogForm({
  organizationSlug,
  mode,
  defaults = {},
}: {
  organizationSlug: string;
  mode: "create" | "edit";
  defaults?: DogFormDefaults;
}) {
  const action = mode === "create" ? createDog : updateDog;
  const [state, formAction, pending] = useActionState(action, initialDogState);

  return (
    <DogFields
      defaults={defaults}
      formAction={formAction}
      mode={mode}
      organizationSlug={organizationSlug}
      pending={pending}
      state={state}
    />
  );
}

export function DogFields({
  organizationSlug,
  mode,
  defaults,
  state,
  formAction,
  pending,
}: {
  organizationSlug: string;
  mode: "create" | "edit";
  defaults: DogFormDefaults;
  state: DogActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className={styles.dogForm} noValidate>
      <input name="organizationSlug" type="hidden" value={organizationSlug} />
      {defaults.id ? <input name="dogId" type="hidden" value={defaults.id} /> : null}
      <div className={styles.formGrid}>
        <label>
          <span>Registered name</span>
          <input
            aria-invalid={Boolean(state.errors?.registeredName)}
            defaultValue={defaults.registeredName}
            maxLength={120}
            name="registeredName"
            required
          />
        </label>
        <label>
          <span>Call name <small>optional</small></span>
          <input defaultValue={defaults.callName ?? ""} maxLength={80} name="callName" />
        </label>
        <label>
          <span>Breed</span>
          <input
            aria-invalid={Boolean(state.errors?.breed)}
            defaultValue={defaults.breed}
            maxLength={120}
            name="breed"
            required
          />
        </label>
        <label>
          <span>Sex</span>
          <select defaultValue={defaults.sex ?? "unknown"} name="sex" required>
            <option value="unknown">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label>
          <span>Birth date</span>
          <input
            aria-invalid={Boolean(state.errors?.birthDate)}
            defaultValue={defaults.birthDate}
            name="birthDate"
            required
            type="date"
          />
        </label>
        <label>
          <span>{mode === "edit" ? "New microchip ID" : "Microchip ID"} <small>optional</small></span>
          <input
            aria-describedby="microchip-help"
            autoComplete="off"
            maxLength={80}
            name="microchip"
            placeholder={defaults.hasMicrochip ? "Fingerprint already stored" : "985 141 000 123 456"}
          />
        </label>
      </div>
      <p className={styles.help} id="microchip-help">
        The raw microchip is fingerprinted in the server process and never stored.
      </p>
      <label className={styles.notesField}>
        <span>Internal notes <small>optional · private</small></span>
        <textarea defaultValue={defaults.notes ?? ""} maxLength={2000} name="notes" rows={5} />
      </label>
      <div className={styles.formFooter}>
        <p className={state.status === "error" ? styles.error : styles.status} role="status">
          {state.message}
        </p>
        <button disabled={pending} type="submit">
          {pending ? "Saving record…" : mode === "create" ? "Create dog record" : "Save changes"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
