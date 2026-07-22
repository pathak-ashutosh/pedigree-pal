# Security

Do not open public issues for vulnerabilities.

Report privately through GitHub Security Advisories for this repository. Include impact, reproduction steps, and affected versions. Expect acknowledgment within 3 business days.

Never submit credentials, private keys, personal data, or production records. PedigreePal will not place personal data on-chain.

Only the latest release is supported once public releases begin.

## Security baseline

Production deployments require an exact HTTPS canonical host, restricted auth
redirects, rate limiting/CAPTCHA, provider MFA, managed secrets, dependency and
database checks, encrypted backups, and tested incident/restore procedures.
See `docs/deployment.md`; free tiers without backups are not production systems.
