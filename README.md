# Beverly CRM

Canonical repository: [ACOB Lighting Technology Limited / Beverly](https://github.com/acob-lighting-technology-limited/beverly)

This project is owned and maintained in the `acob-lighting-technology-limited` GitHub organization. All branches, issues, pull requests, releases, and automation must use this repository as the source of truth.

Status: release blocked.

Read first:
- [Meter ingestion recovery](docs/METER_INGESTION_IMPLEMENTATION_STATUS_2026-10-25.md)
- [Capacity status](docs/DATABASE_CAPACITY_STATUS_2026-10-25.md)
- [Master Playbook](docs/MASTER_PLAYBOOK.md)
- [Release Status](docs/RELEASE_STATUS.md)
- [Production Gap Analysis](docs/PRODUCTION_GAP_ANALYSIS.md)
- [Architecture](ARCHITECTURE.md)
- [Remaining Work](docs/REMAINING_WORK.md)

Current truth:
- Local verification is mostly green.
- Public Vercel smoke is failing.
- Remote CI is not proven for this branch.
- Preview Supabase envs exist.
- Production release is blocked.

Canonical architecture:
- Root `ARCHITECTURE.md` is canonical.
- `docs/ARCHITECTURE.md` is legacy reference.

Release gates:
```powershell
npm run build
npm run typecheck
npm test
npm run hardening:audit
npm run test:browser
$env:TARGET_URL="https://your-preview-url.vercel.app"
npm run smoke:vercel
```

Do not ship until:
- all local gates pass
- public preview smoke passes
- Supabase preview smoke passes
- GitHub Actions pass
- release status is updated
