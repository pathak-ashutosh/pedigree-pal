import Link from "next/link";
import { requireOrganization } from "@/lib/organizations/dal";
import { DogForm } from "../dog-form";
import styles from "../dogs.module.css";

export default async function NewDogPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  await requireOrganization(organizationSlug, "dogs:write");

  return (
    <section className={styles.formPage}>
      <Link className={styles.backLink} href={`/dashboard/${organizationSlug}/dogs`}>← Dog registry</Link>
      <h1>Add a dog record.</h1>
      <p>Start with the facts you can support. Parent links are added after this record is created.</p>
      <DogForm mode="create" organizationSlug={organizationSlug} />
    </section>
  );
}
