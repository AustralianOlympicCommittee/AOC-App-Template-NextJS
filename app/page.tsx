import { getCurrentUser } from "../lib/auth/session";
import { hasAppRole } from "../lib/auth/types";

const checks = [
  "Next.js runtime is packaged into one Container App.",
  "Lakebase connectivity is tested through an authorised /api/audit-test call.",
  "Audit rows are written to Lakebase and mirrored to structured logs.",
  "Databricks OAuth uses a two-secret fallback without logging secret values.",
  "Runtime Entra sessions carry app-role claims before API access is allowed."
];

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  const hasReadAccess = user ? hasAppRole(user, "App.Read") : false;
  const authError = asString(params.auth_error);
  const authMessage = asString(params.auth_message);

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Phase 1D</p>
        <h1>AOC organisational app proof</h1>
        <p className="lede">
          This minimal app now proves runtime Entra sign-in, app-role
          authorisation, Databricks Lakebase connectivity, audit writes and Log
          Analytics redundancy before the full template build-out.
        </p>
        {authError ? (
          <div className="notice" role="alert">
            <strong>Sign-in failed</strong>
            <span>{authMessage || authError}</span>
          </div>
        ) : null}
        <div className="session">
          {user ? (
            <>
              <div>
                <span className="label">Signed in as</span>
                <strong>{user.displayName}</strong>
                <span className="muted">{user.username}</span>
              </div>
              <div className="role-list" aria-label="Assigned app roles">
                {user.roles.length > 0 ? (
                  user.roles.map((role) => <span key={role}>{role}</span>)
                ) : (
                  <span>No app role</span>
                )}
              </div>
              <a className="button secondary" href="/api/auth/logout">
                Sign out
              </a>
            </>
          ) : (
            <>
              <div>
                <span className="label">Access</span>
                <strong>Entra sign-in required</strong>
                <span className="muted">
                  App roles are assigned through the Enterprise Application.
                </span>
              </div>
              <a className="button" href="/api/auth/login">
                Sign in
              </a>
            </>
          )}
        </div>
        {user && !hasReadAccess ? (
          <div className="notice" role="status">
            <strong>Access pending</strong>
            <span>Your account is signed in but does not have App.Read, App.Write or App.Admin.</span>
          </div>
        ) : null}
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
              {user && hasAppRole(user, "App.Admin") ? (
                <a href="/api/audit-test">/api/audit-test</a>
              ) : (
                <span>Requires App.Admin</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>
              <a href="/api/auth/me">/api/auth/me</a>
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

function asString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
