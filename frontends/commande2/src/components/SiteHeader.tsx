import { Brand } from "@surplasse/design-system2";
import { Link } from "react-router-dom";

import { fr } from "../i18n/fr";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand-link" to="/" aria-label={fr.cart.backToMenu}>
        <Brand tagline={fr.brand.tagline} />
      </Link>
    </header>
  );
}
