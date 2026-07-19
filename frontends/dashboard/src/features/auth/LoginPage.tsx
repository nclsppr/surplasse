import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { dashboardClients } from "../../app/runtime";
import { AuthShell } from "../../components/AuthShell";
import { fr } from "../../i18n/fr";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const magicLinkRequest = useMutation({
    mutationFn: () => dashboardClients.identity.requestMagicLink(email),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    magicLinkRequest.mutate();
  }

  return (
    <AuthShell>
      <p className="eyebrow">{fr.auth.eyebrow}</p>
      <h1>{fr.auth.loginTitle}</h1>
      <p className="auth-intro">{fr.auth.loginDescription}</p>

      {magicLinkRequest.isSuccess ? (
        <div className="notice notice-success" role="status">
          <p>{fr.auth.requestSuccess}</p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">{fr.auth.emailLabel}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={fr.auth.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {magicLinkRequest.isError ? (
            <p className="form-error" role="alert">
              {fr.auth.requestError}
            </p>
          ) : null}
          <button className="button button-primary button-wide" disabled={magicLinkRequest.isPending}>
            {magicLinkRequest.isPending ? fr.auth.submitting : fr.auth.submit}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
