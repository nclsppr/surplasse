import { Brand } from "@surplasse/design-system2";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { domainLinks } from "../app/runtime";
import { fr } from "../i18n/fr";

export function SiteFooter() {
  return (
    <footer className="ob2-footer">
      <div className="ob2-shell ob2-footer-main">
        <div className="ob2-footer-brand">
          <Brand />
          <p>{fr.footer.description}</p>
          <Link to="/creer">{fr.footer.demo} <ArrowUpRight aria-hidden="true" /></Link>
        </div>
        <nav className="ob2-footer-nav" aria-label={fr.footer.navigationLabel}>
          <div>
            <h2>{fr.footer.groups.product.title}</h2>
            <a href="#fonctionnement">{fr.footer.groups.product.howItWorks}</a>
            <a href="#service-live">{fr.footer.groups.product.liveService}</a>
            <a href="#tarif">{fr.footer.groups.product.pricing}</a>
          </div>
          <div>
            <h2>{fr.footer.groups.resources.title}</h2>
            <a href={domainLinks.productVision}>{fr.footer.groups.resources.productVision}</a>
            <a href={domainLinks.roadmap}>{fr.footer.groups.resources.roadmap}</a>
            <a href={domainLinks.docs}>{fr.footer.groups.resources.documentation}</a>
          </div>
          <div>
            <h2>{fr.footer.groups.access.title}</h2>
            <Link to="/creer">{fr.footer.groups.access.demo}</Link>
            <a href={domainLinks.dashboardLogin}>{fr.footer.groups.access.restaurantSpace}</a>
            <a href="#questions">{fr.footer.groups.access.faq}</a>
          </div>
        </nav>
      </div>
      <div className="ob2-shell ob2-footer-bottom">
        <span>{fr.footer.copyright}</span>
        <span className="ob2-direct-signal"><i aria-hidden="true" /> {fr.footer.directChannel}</span>
      </div>
    </footer>
  );
}
