import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import { DogForm, type DogFormDefaults } from "../../dog-form";
import styles from "../../dogs.module.css";

export default async function EditDogPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; dogId: string }>;
}) {
  const { organizationSlug, dogId } = await params;
  const access = await requireOrganization(organizationSlug, "dogs:write");
  const { data, error } = await access.supabase
    .from("dogs")
    .select("id, registered_name, call_name, breed, sex, birth_date, microchip_hash, notes")
    .eq("organization_id", access.id)
    .eq("id", dogId)
    .maybeSingle();

  if (error) {
    logger.error({ event: "dog.edit_load_failed", errorCode: error.code }, "dog edit load failed");
    throw new Error("The dog record is temporarily unavailable.");
  }
  if (!data) notFound();

  const dog = data as {
    id: string;
    registered_name: string;
    call_name: string | null;
    breed: string;
    sex: DogFormDefaults["sex"];
    birth_date: string;
    microchip_hash: string | null;
    notes: string | null;
  };

  return (
    <section className={styles.formPage}>
      <Link
        className={styles.backLink}
        href={`/dashboard/${organizationSlug}/dogs/${dog.id}`}
      >
        ← Dog record
      </Link>
      <h1>Refine the record.</h1>
      <p>Changes are tenant-scoped and appended to the audit history.</p>
      <DogForm
        defaults={{
          id: dog.id,
          registeredName: dog.registered_name,
          callName: dog.call_name,
          breed: dog.breed,
          sex: dog.sex,
          birthDate: dog.birth_date,
          notes: dog.notes,
          hasMicrochip: Boolean(dog.microchip_hash),
        }}
        mode="edit"
        organizationSlug={organizationSlug}
      />
    </section>
  );
}
