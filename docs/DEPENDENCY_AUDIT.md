# Dependency audit boundary

The production Vercel application ships the root web and API dependency graph.
Run `pnpm audit:production` as a blocking release gate; it rejects every critical
or high advisory that reaches that deployed graph.

The `apps/mobile` Expo 51 workspace is not deployed by Vercel. Its legacy CLI
currently retains high advisories in build-time packages. The verifier reports
that hold separately instead of hiding it or treating it as deployed-web risk.
Do not release a mobile build until that workspace is upgraded to a supported
Expo SDK and a full unfiltered `pnpm audit --prod` has no critical or high
findings.
