import { Brand, Button } from "@surplasse/design-system2";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { fr } from "../i18n/fr";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="ui2-root ob2-not-found">
      <Brand />
      <p className="ob2-kicker">{fr.notFound.kicker}</p>
      <h1>{fr.notFound.title}</h1>
      <p>{fr.notFound.description}</p>
      <Button iconLeading={<ArrowLeft aria-hidden="true" />} onPress={() => navigate("/")}>{fr.notFound.action}</Button>
    </main>
  );
}
