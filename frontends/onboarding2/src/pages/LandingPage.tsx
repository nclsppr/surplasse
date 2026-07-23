import {
  Badge,
  Button,
} from "@surplasse/design-system2";
import {
  servicePass1600Url,
} from "@surplasse/design-system2/assets/service-pass-1600";
import {
  servicePass960Url,
} from "@surplasse/design-system2/assets/service-pass-960";
import {
  tableSetting960Url,
} from "@surplasse/design-system2/assets/table-setting-960";
import {
  tableSetting640Url,
} from "@surplasse/design-system2/assets/table-setting-640";
import {
  ArrowDown,
  ArrowRight,
  Camera,
  Check,
  ChefHat,
  CreditCard,
  QrCode,
  ScanLine,
  UtensilsCrossed,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ExperimentHeader } from "../components/ExperimentHeader";
import { PagesDemoNotice } from "../components/PagesDemoNotice";
import { ServiceDemo } from "../components/ServiceDemo";
import { SiteFooter } from "../components/SiteFooter";
import { fr } from "../i18n/fr";

const processSteps = [
  {
    ...fr.landing.process.steps.card,
    icon: Camera,
  },
  {
    ...fr.landing.process.steps.structure,
    icon: Check,
  },
  {
    ...fr.landing.process.steps.table,
    icon: QrCode,
  },
  {
    ...fr.landing.process.steps.kitchen,
    icon: ChefHat,
  },
] as const;

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="ui2-root ob2-page">
      <a className="ob2-skip-link" href="#contenu">{fr.common.skipToContent}</a>
      <ExperimentHeader />
      <PagesDemoNotice />

      <main id="contenu">
        <section className="ob2-hero" aria-labelledby="ob2-hero-title">
          <div className="ob2-shell ob2-hero-grid">
            <div className="ob2-hero-copy">
              <Badge tone="brand" dot>{fr.landing.hero.experiment}</Badge>
              <p className="ob2-kicker">{fr.landing.hero.kicker}</p>
              <h1 id="ob2-hero-title">{fr.landing.hero.title}</h1>
              <p className="ob2-hero-intro">{fr.landing.hero.intro}</p>
              <div className="ob2-hero-actions">
                <Button size="lg" iconTrailing={<ArrowRight aria-hidden="true" />} onPress={() => navigate("/creer")}>
                  {fr.landing.hero.demo}
                </Button>
                <a href="#client">{fr.landing.hero.seeCustomerJourney} <ArrowDown aria-hidden="true" /></a>
              </div>
            </div>

            <figure className="ob2-hero-visual" aria-label={fr.landing.hero.visualLabel}>
              <picture>
                <source media="(max-width: 760px)" srcSet={servicePass960Url} />
                <img
                  src={servicePass1600Url}
                  alt=""
                  width="1600"
                  height="901"
                  fetchPriority="high"
                />
              </picture>
              <figcaption>
                <Badge tone="neutral">{fr.landing.hero.visualBadge}</Badge>
                <span>{fr.landing.hero.visualCaption}</span>
              </figcaption>
            </figure>

            <div className="ob2-route-strip" aria-label={fr.landing.hero.routeLabel}>
              <span><ScanLine aria-hidden="true" /> {fr.landing.hero.route.scan}</span>
              <i aria-hidden="true" />
              <span><UtensilsCrossed aria-hidden="true" /> {fr.landing.hero.route.choose}</span>
              <i aria-hidden="true" />
              <span><CreditCard aria-hidden="true" /> {fr.landing.hero.route.pay}</span>
              <i aria-hidden="true" />
              <span><ChefHat aria-hidden="true" /> {fr.landing.hero.route.serve}</span>
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="ob2-process" aria-labelledby="ob2-process-title">
          <div className="ob2-shell">
            <div className="ob2-section-heading">
              <div>
                <p className="ob2-kicker">{fr.landing.process.kicker}</p>
                <h2 id="ob2-process-title">{fr.landing.process.title}</h2>
              </div>
              <p>{fr.landing.process.intro}</p>
            </div>

            <ol className="ob2-process-list">
              {processSteps.map(({ description, icon: Icon, label, status, title }) => (
                <li key={label}>
                  <span className="ob2-step-icon"><Icon aria-hidden="true" /></span>
                  <span className="ob2-step-label">{label}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                  <Badge tone="neutral">{status}</Badge>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="service-live" className="ob2-live" aria-labelledby="ob2-live-title">
          <div className="ob2-shell ob2-live-grid">
            <div className="ob2-live-copy">
              <Badge tone="info">{fr.landing.live.badge}</Badge>
              <p className="ob2-kicker ob2-kicker-inverse">{fr.landing.live.kicker}</p>
              <h2 id="ob2-live-title">{fr.landing.live.title}</h2>
              <p>{fr.landing.live.description}</p>
            </div>
            <ServiceDemo />
          </div>
        </section>

        <section id="tarif" className="ob2-direct" aria-labelledby="ob2-direct-title">
          <div className="ob2-shell">
            <div className="ob2-section-heading">
              <div>
                <p className="ob2-kicker">{fr.landing.direct.kicker}</p>
                <h2 id="ob2-direct-title">{fr.landing.direct.title}</h2>
              </div>
              <p>{fr.landing.direct.intro}</p>
            </div>

            <div className="ob2-direct-lines">
              {fr.landing.direct.points.map((point) => (
                <article key={point.label}>
                  <span>{point.label}</span>
                  <h3>{point.title}</h3>
                  <p>{point.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="client" className="ob2-client" aria-labelledby="ob2-client-title">
          <div className="ob2-shell ob2-client-grid">
            <figure className="ob2-client-visual">
              <picture>
                <source media="(max-width: 760px)" srcSet={tableSetting640Url} />
                <img
                  src={tableSetting960Url}
                  alt=""
                  width="960"
                  height="1200"
                  loading="lazy"
                />
              </picture>
              <figcaption>{fr.landing.customer.visualCaption}</figcaption>
            </figure>
            <div className="ob2-client-copy">
              <p className="ob2-kicker">{fr.landing.customer.kicker}</p>
              <h2 id="ob2-client-title">{fr.landing.customer.title}</h2>
              <p>{fr.landing.customer.description}</p>
              <dl className="ob2-benefits">
                {fr.landing.customer.benefits.map((benefit) => (
                  <div key={benefit.title}>
                    <dt>{benefit.title}</dt><dd>{benefit.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="questions" className="ob2-faq" aria-labelledby="ob2-faq-title">
          <div className="ob2-shell ob2-faq-grid">
            <div>
              <p className="ob2-kicker">{fr.landing.faq.kicker}</p>
              <h2 id="ob2-faq-title">{fr.landing.faq.title}</h2>
            </div>
            <div className="ob2-faq-list">
              {fr.landing.faq.items.map((item, index) => (
                <details key={item.question} open={index === 0 || undefined}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="ob2-final" aria-labelledby="ob2-final-title">
          <div className="ob2-shell ob2-final-grid">
            <div>
              <p className="ob2-kicker ob2-kicker-inverse">{fr.landing.final.kicker}</p>
              <h2 id="ob2-final-title">{fr.landing.final.title}</h2>
            </div>
            <div>
              <Button size="lg" iconTrailing={<ArrowRight aria-hidden="true" />} onPress={() => navigate("/creer")}>
                {fr.landing.final.action}
              </Button>
              <span>{fr.landing.final.description}</span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
