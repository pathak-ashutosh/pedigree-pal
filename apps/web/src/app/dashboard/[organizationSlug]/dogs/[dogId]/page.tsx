import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/domain/rbac";
import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import { ArchiveForm } from "./archive-form";
import { FinalizeForm } from "./finalize-form";
import { ParentForm, type ParentCandidate } from "./parent-form";
import styles from "../dogs.module.css";

type DogRecord = {
  id: string;
  registered_name: string;
  call_name: string | null;
  breed: string;
  sex: "male" | "female" | "unknown";
  birth_date: string;
  microchip_hash: string | null;
  status: string;
  notes: string | null;
  record_version: number;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

type AttestationRow = {
  record_version: number;
  record_hash: string;
  status: "pending" | "confirmed" | "revoked";
  created_at: string;
};

type ParentLink = { kind: "sire" | "dam"; parent_id: string };
type CandidateRow = {
  id: string;
  registered_name: string;
  sex: "male" | "female" | "unknown";
};

export default async function DogDetailPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; dogId: string }>;
}) {
  const { organizationSlug, dogId } = await params;
  const access = await requireOrganization(organizationSlug);
  const { data: dogData, error: dogError } = await access.supabase
    .from("dogs")
    .select(
      "id, registered_name, call_name, breed, sex, birth_date, microchip_hash, status, notes, record_version, finalized_at, created_at, updated_at",
    )
    .eq("organization_id", access.id)
    .eq("id", dogId)
    .maybeSingle();

  if (dogError) {
    logger.error({ event: "dog.detail_failed", errorCode: dogError.code }, "dog detail failed");
    throw new Error("The dog record is temporarily unavailable.");
  }
  if (!dogData) notFound();
  const dog = dogData as DogRecord;

  const [parentResult, candidateResult, attestationResult] = await Promise.all([
    access.supabase
      .from("dog_parents")
      .select("kind, parent_id")
      .eq("organization_id", access.id)
      .eq("child_id", dog.id),
    access.supabase
      .from("dogs")
      .select("id, registered_name, sex")
      .eq("organization_id", access.id)
      .neq("id", dog.id)
      .neq("status", "archived")
      .lt("birth_date", dog.birth_date)
      .order("registered_name")
      .limit(200),
    access.supabase
      .from("attestations")
      .select("record_version, record_hash, status, created_at")
      .eq("organization_id", access.id)
      .eq("dog_id", dog.id)
      .order("record_version", { ascending: false })
      .limit(10),
  ]);

  if (parentResult.error || candidateResult.error || attestationResult.error) {
    const error = parentResult.error ?? candidateResult.error ?? attestationResult.error;
    logger.error(
      { event: "pedigree.detail_failed", errorCode: error?.code ?? "unknown" },
      "pedigree detail failed",
    );
    throw new Error("The pedigree is temporarily unavailable.");
  }

  const parentLinks = (parentResult.data ?? []) as ParentLink[];
  const candidateRows = (candidateResult.data ?? []) as CandidateRow[];
  const attestations = (attestationResult.data ?? []) as AttestationRow[];
  const mayEdit = can(access.role, "dogs:write");
  const mayAttest = can(access.role, "dogs:attest");
  const candidates = new Map(candidateRows.map((row) => [row.id, row]));
  const parentFor = (kind: "sire" | "dam"): ParentCandidate | undefined => {
    const link = parentLinks.find((parent) => parent.kind === kind);
    const record = link ? candidates.get(link.parent_id) : undefined;
    return record ? { id: record.id, registeredName: record.registered_name } : undefined;
  };
  const candidatesFor = (kind: "sire" | "dam"): ParentCandidate[] =>
    candidateRows
      .filter((candidate) => candidate.sex === (kind === "sire" ? "male" : "female"))
      .map((candidate) => ({ id: candidate.id, registeredName: candidate.registered_name }));

  return (
    <>
      <header className={styles.recordHeader}>
        <div>
          <p className={styles.detailEyebrow}>Dog record · {dog.status}</p>
          <h1>{dog.registered_name}</h1>
          <p>{dog.call_name ? `Known as ${dog.call_name}` : dog.breed}</p>
        </div>
        <div className={styles.recordActions}>
          <Link href={`/dashboard/${organizationSlug}/dogs`}>Registry</Link>
          {mayEdit ? (
            <Link href={`/dashboard/${organizationSlug}/dogs/${dog.id}/edit`}>Edit record</Link>
          ) : null}
        </div>
      </header>
      <div className={styles.recordGrid}>
        <section className={styles.recordCard}>
          <h2>Registry facts</h2>
          <dl className={styles.recordDetails}>
            <div><dt>Breed</dt><dd>{dog.breed}</dd></div>
            <div><dt>Sex</dt><dd>{dog.sex}</dd></div>
            <div><dt>Birth date</dt><dd>{dog.birth_date}</dd></div>
            <div><dt>Microchip</dt><dd>{dog.microchip_hash ? "Private fingerprint stored" : "Not recorded"}</dd></div>
            <div><dt>Created</dt><dd>{new Date(dog.created_at).toLocaleDateString("en-US")}</dd></div>
            <div><dt>Updated</dt><dd>{new Date(dog.updated_at).toLocaleDateString("en-US")}</dd></div>
          </dl>
          {dog.notes ? <p className={styles.help}>Internal note: {dog.notes}</p> : null}
        </section>
        <section className={styles.pedigreeCard}>
          <h2>Pedigree links</h2>
          {mayEdit ? (
            <div className={styles.parentForms}>
              <ParentForm
                candidates={candidatesFor("sire")}
                childId={dog.id}
                currentParent={parentFor("sire")}
                kind="sire"
                organizationSlug={organizationSlug}
              />
              <ParentForm
                candidates={candidatesFor("dam")}
                childId={dog.id}
                currentParent={parentFor("dam")}
                kind="dam"
                organizationSlug={organizationSlug}
              />
            </div>
          ) : (
            <dl className={styles.readonlyParents}>
              <div><dt>Sire</dt><dd>{parentFor("sire")?.registeredName ?? "Not assigned"}</dd></div>
              <div><dt>Dam</dt><dd>{parentFor("dam")?.registeredName ?? "Not assigned"}</dd></div>
            </dl>
          )}
        </section>
      </div>
      <section className={styles.recordCard}>
        <h2>Record integrity</h2>
        <p className={styles.help}>
          {dog.finalized_at
            ? `Version ${dog.record_version} finalized on ${new Date(dog.finalized_at).toLocaleDateString("en-US")}.`
            : `Version ${dog.record_version} is a draft — edits are open until it is finalized.`}
        </p>
        {attestations.length > 0 ? (
          <dl className={styles.recordDetails}>
            {attestations.map((attestation) => (
              <div key={attestation.record_version}>
                <dt>Version {attestation.record_version} · {attestation.status}</dt>
                <dd className={styles.hash}>{attestation.record_hash}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.help}>No attestations yet.</p>
        )}
        {mayAttest && !dog.finalized_at && dog.status !== "archived" ? (
          <FinalizeForm
            dogId={dog.id}
            organizationSlug={organizationSlug}
            recordVersion={dog.record_version}
          />
        ) : null}
      </section>
      {can(access.role, "dogs:delete") ? (
        <ArchiveForm dogId={dog.id} organizationSlug={organizationSlug} />
      ) : null}
    </>
  );
}
