import { fr } from "../i18n/fr";
import logoUrl from "../../../../brand/logo.svg";

export function Brand() {
  return (
    <div className="brand">
      <img className="brand-wordmark" src={logoUrl} alt={fr.brand.name} />
      <small className="brand-tagline">{fr.brand.tagline}</small>
    </div>
  );
}
