import { fr } from "../i18n/fr";
import markUrl from "../../../../brand/mark.svg";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-lockup" aria-label={fr.brand.name}>
        <img className="brand-mark" src={markUrl} alt="" />
        <span className="brand-wordmark">{fr.brand.name}</span>
      </span>
      <small className="brand-tagline">{fr.brand.tagline}</small>
    </div>
  );
}
