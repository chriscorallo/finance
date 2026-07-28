// Stand-in for the `server-only` / `client-only` marker packages under
// Vitest, which doesn't set up Next.js's `react-server` export condition —
// those packages unconditionally throw outside that condition. Aliased in
// vitest.config.ts.
export {};
