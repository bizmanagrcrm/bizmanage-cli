# Documentation snapshot receipt foundation

`validateSnapshotReceipt` accepts only a complete, read-only snapshot receipt bound to a trusted explicit alias, tenant ID and HTTPS instance endpoint. It checks stable Core/customization revisions, all six customization families, every collection state/count, stable platform IDs and content hashes. `unavailable` and `unsupported` are non-publishable; they are never mistaken for empty. Extra fields such as credential values are rejected. This validator does not use the ordinary pull hash cache or make a network request.

Run `npm run test:docs-snapshot`. The fictional focused test has 100% lines/functions and at least 98% branches for this contract.

This is not yet the `pull-snapshot` command or a safe live export. The signed alias registry, Core safe-read endpoint, complete source/component materialization, three-retry revision check, sanitized `docs-snapshot` derivation, and released CLI pair must be implemented before live use. Do not substitute ordinary `bizmanage pull` for this strict path.
