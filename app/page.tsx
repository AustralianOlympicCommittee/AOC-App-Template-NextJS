const checks = [
  "Next.js runtime is packaged into one Container App.",
  "Lakebase connectivity is tested through /api/audit-test.",
  "Audit rows are written to Lakebase and mirrored to structured logs.",
  "Databricks OAuth uses a two-secret fallback without logging secret values."
];

export default function Home() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Phase 0</p>
        <h1>AOC organisational app proof</h1>
        <p className="lede">
          This minimal app proves the runtime, Databricks Lakebase connection,
          audit write and Log Analytics redundancy path before the full template
          build-out.
        </p>
        <dl className="links">
          <div>
            <dt>Health</dt>
            <dd>
              <a href="/api/health">/api/health</a>
            </dd>
          </div>
          <div>
            <dt>Audit Test</dt>
            <dd>
              <a href="/api/audit-test">/api/audit-test</a>
            </dd>
          </div>
        </dl>
      </section>
      <section className="checklist" aria-label="Phase 0 checks">
        {checks.map((check) => (
          <article key={check}>
            <span aria-hidden="true">✓</span>
            <p>{check}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
