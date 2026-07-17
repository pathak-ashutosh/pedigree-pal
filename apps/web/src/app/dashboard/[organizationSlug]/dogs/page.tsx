import Link from "next/link";
import { can } from "@/domain/rbac";
import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import styles from "./dogs.module.css";

type DogListRow = {
  id: string;
  registered_name: string;
  call_name: string | null;
  breed: string;
  sex: string;
  birth_date: string;
  status: string;
};

function escapeSearch(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&").slice(0, 100);
}

export default async function DogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ organizationSlug }, query] = await Promise.all([params, searchParams]);
  const access = await requireOrganization(organizationSlug);
  const search = query.q?.trim() ?? "";
  let request = access.supabase
    .from("dogs")
    .select("id, registered_name, call_name, breed, sex, birth_date, status")
    .eq("organization_id", access.id)
    .neq("status", "archived")
    .order("registered_name")
    .limit(100);

  if (search) {
    request = request.ilike("registered_name", `%${escapeSearch(search)}%`);
  }

  const { data, error } = await request;
  if (error) {
    logger.error({ event: "dog.list_failed", errorCode: error.code }, "dog list failed");
    throw new Error("The dog registry is temporarily unavailable.");
  }
  const dogs = (data ?? []) as DogListRow[];

  return (
    <>
      <header className={styles.registryHeader}>
        <div>
          <p>Private organization registry</p>
          <h1>Dogs</h1>
        </div>
        {can(access.role, "dogs:write") ? (
          <Link href={`/dashboard/${organizationSlug}/dogs/new`}>Add dog →</Link>
        ) : null}
      </header>
      <form className={styles.searchForm} role="search">
        <input
          aria-label="Search registered names"
          defaultValue={search}
          maxLength={100}
          name="q"
          placeholder="Search registered name"
          type="search"
        />
        <button type="submit">Search</button>
      </form>
      {dogs.length > 0 ? (
        <table className={styles.dogTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Breed</th>
              <th>Sex</th>
              <th>Born</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dogs.map((dog) => (
              <tr key={dog.id}>
                <td>
                  <Link href={`/dashboard/${organizationSlug}/dogs/${dog.id}`}>
                    {dog.registered_name}
                  </Link>
                  <small>{dog.call_name || "No call name"}</small>
                </td>
                <td>{dog.breed}</td>
                <td>{dog.sex}</td>
                <td>{dog.birth_date}</td>
                <td><span className={styles.statusBadge}>{dog.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <section className={styles.emptyRegistry}>
          <h2>{search ? "No matching dogs." : "The registry is ready."}</h2>
          <p>{search ? "Try a different registered name." : "Add the first private dog record."}</p>
          {search || can(access.role, "dogs:write") ? (
            <Link href={search ? `/dashboard/${organizationSlug}/dogs` : `/dashboard/${organizationSlug}/dogs/new`}>
              {search ? "Clear search" : "Create first record"} →
            </Link>
          ) : null}
        </section>
      )}
    </>
  );
}
