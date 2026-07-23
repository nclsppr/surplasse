import { Brand, Button } from "@surplasse/design-system2";
import { LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { domainLinks } from "../app/runtime";
import { fr } from "../i18n/fr";

export function ExperimentHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="ob2-header">
      <div className="ob2-shell ob2-header-inner">
        <Link className="ob2-brand-link" to="/" aria-label={fr.common.brand.experimentalHomeLabel}>
          <Brand tagline={fr.common.brand.tagline} />
        </Link>

        <button
          className="ob2-menu-button"
          type="button"
          aria-expanded={isOpen}
          aria-controls="ob2-primary-nav"
          aria-label={isOpen ? fr.header.closeNavigationLabel : fr.header.openNavigationLabel}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav
          id="ob2-primary-nav"
          className="ob2-nav"
          data-open={isOpen || undefined}
          aria-label={fr.header.navigationLabel}
        >
          <a href="#fonctionnement" onClick={() => setIsOpen(false)}>{fr.header.links.howItWorks}</a>
          <a href="#service-live" onClick={() => setIsOpen(false)}>{fr.header.links.liveService}</a>
          <a href="#tarif" onClick={() => setIsOpen(false)}>{fr.header.links.pricing}</a>
          <div className="ob2-nav-mobile-actions">
            <a className="ob2-login-link" href={domainLinks.dashboardLogin}>
              <LogIn aria-hidden="true" />
              {fr.header.login}
            </a>
            <Button
              size="md"
              onPress={() => {
                setIsOpen(false);
                navigate("/creer");
              }}
            >
              {fr.header.demo}
            </Button>
          </div>
        </nav>

        <div className="ob2-header-actions">
          <a className="ob2-login-link" href={domainLinks.dashboardLogin}>
            <LogIn aria-hidden="true" />
            {fr.header.login}
          </a>
          <Button size="sm" onPress={() => navigate("/creer")}>{fr.header.demo}</Button>
        </div>
      </div>
    </header>
  );
}
