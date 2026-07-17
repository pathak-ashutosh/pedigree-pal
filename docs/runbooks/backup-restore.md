# Backup and restore

## Policy

- Enable managed PostgreSQL point-in-time recovery; target RPO 15 minutes, RTO 4 hours.
- Version private object storage and retain audit/outbox data per the approved retention policy.
- Keep environments/projects isolated. Encrypt backups and restrict restore access.

## Quarterly restore drill

1. Record source snapshot and restore target; never overwrite production.
2. Restore database and object storage into an isolated project.
3. Apply only migrations newer than the snapshot.
4. Run pgTAP, database lint, counts/checksums, tenant-isolation probes, login, and representative registry reads.
5. Record achieved RPO/RTO, gaps, owners, and cleanup evidence.

For accidental writes, stop the writer first, capture the incident time, restore to a new target, validate, then switch traffic. Prefer selective repair only with a reviewed immutable audit trail.
