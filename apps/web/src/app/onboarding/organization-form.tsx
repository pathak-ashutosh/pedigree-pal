"use client";

import { useActionState, useState } from "react";
import { createOrganization } from "@/app/actions/organizations";
import { suggestOrganizationSlug } from "@/domain/organizations";
import { initialOrganizationState, type OrganizationActionState } from "@/lib/organizations/state";
import styles from "./onboarding.module.css";

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialOrganizationState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <OrganizationFields
      formAction={formAction}
      name={name}
      onNameChange={(value) => {
        setName(value);
        if (!slugEdited) setSlug(suggestOrganizationSlug(value));
      }}
      onSlugChange={(value) => {
        setSlug(value);
        setSlugEdited(true);
      }}
      pending={pending}
      slug={slug}
      state={state}
    />
  );
}

export function OrganizationFields({
  state,
  formAction,
  pending,
  name,
  slug,
  onNameChange,
  onSlugChange,
}: {
  state: OrganizationActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  name: string;
  slug: string;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
}) {
  return (
    <form action={formAction} className={styles.form} noValidate>
      <label htmlFor="organization-name">Organization name</label>
      <input
        aria-invalid={Boolean(state.errors?.name)}
        autoComplete="organization"
        id="organization-name"
        name="name"
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Northstar Kennels"
        required
        value={name}
      />
      <label htmlFor="organization-slug">Workspace URL</label>
      <div className={styles.slugField}>
        <span>pedigreepal.com/</span>
        <input
          aria-invalid={Boolean(state.errors?.slug)}
          id="organization-slug"
          name="slug"
          onChange={(event) => onSlugChange(event.target.value)}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="northstar-kennels"
          required
          value={slug}
        />
      </div>
      <button disabled={pending} type="submit">
        {pending ? "Creating workspace…" : "Create workspace"}
        <span aria-hidden="true">→</span>
      </button>
      <p className={styles.status} role="status">
        {state.message}
      </p>
    </form>
  );
}
