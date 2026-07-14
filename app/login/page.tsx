import { AresMark } from "../../components/assignment-ui/AresMark";
import { sanitizeReturnPath } from "../../src/auth/session";
import styles from "./login.module.css";

export const metadata = {
  title: "Login | ARES",
  description: "Unlock your private ARES workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeReturnPath(params?.next);
  const hasError = params?.error === "1";

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-label="Login to ARES">
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">
            <AresMark />
          </span>
          <div>
            <h1>ARES</h1>
            <p>Enter your app password to update habits, assignments, and notes.</p>
          </div>
        </div>
        <form className={styles.form} action="/api/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
          />
          {hasError ? <p className={styles.error}>That password did not work.</p> : null}
          <button type="submit">Unlock</button>
        </form>
      </section>
    </main>
  );
}
