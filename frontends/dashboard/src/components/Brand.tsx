import { fr } from "../i18n/fr";
import logoUrl from "../../../../brand/surplasse-logo-horizontal.svg";

export function Brand() {
  return (
    <div className="brand">
      <img className="brand-logo" src={logoUrl} alt={fr.brand.name} />
      <small className="brand-tagline">{fr.brand.tagline}</small>
    </div>
  );
}
