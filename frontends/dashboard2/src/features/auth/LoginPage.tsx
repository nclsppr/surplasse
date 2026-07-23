import { useState, type FormEvent } from "react";
import { Badge, Button, Field } from "@surplasse/design-system2";
import { useMutation } from "@tanstack/react-query";

import { dashboardClients, pagesDemoEnabled } from "../../app/runtime";
import { AuthShell } from "../../components/AuthShell";
import { fr } from "../../i18n/fr";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const magicLinkRequest = useMutation({
    mutationFn: () => dashboardClients.identity.requestMagicLink(email),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pagesDemoEnabled) {
      return;
    }
    magicLinkRequest.mutate();
  }

  return (
    <AuthShell>
      <p className="eyebrow">{fr.auth.eyebrow}</p>
      <h1>{fr.auth.loginTitle}</h1>
      <p className="auth-intro">{fr.auth.loginDescription}</p>

      {pagesDemoEnabled ? (
        <div className="notice notice-info" role="status">
          <Badge tone="info">{fr.auth.pagesDemoBadge}</Badge>
          <p>{fr.auth.pagesDemoDescription}</p>
        </div>
      ) : null}

      {magicLinkRequest.isSuccess ? (
        <div className="notice notice-success" role="status">
          <p>{fr.auth.requestSuccess}</p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <Field
            aria-label={fr.auth.emailLabel}
            label={fr.auth.emailLabel}
            type="email"
            autoComplete="email"
            placeholder={fr.auth.emailPlaceholder}
            value={email}
            onChange={setEmail}
            isDisabled={pagesDemoEnabled}
            isRequired
          />
          {magicLinkRequest.isError ? (
            <p className="form-error" role="alert">
              {fr.auth.requestError}
            </p>
          ) : null}
          <Button className="button-wide" isDisabled={pagesDemoEnabled || magicLinkRequest.isPending} isLoading={magicLinkRequest.isPending} type="submit">
            {magicLinkRequest.isPending ? fr.auth.submitting : fr.auth.submit}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
