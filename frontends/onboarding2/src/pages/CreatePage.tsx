import {
  Badge,
  Brand,
  Button,
} from "@surplasse/design-system2";
import {
  servicePass1600Url,
} from "@surplasse/design-system2/assets/service-pass-1600";
import {
  servicePass960Url,
} from "@surplasse/design-system2/assets/service-pass-960";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, ExternalLink, ScanSearch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { domainLinks, pagesDemoEnabled } from "../app/runtime";
import { PagesDemoNotice } from "../components/PagesDemoNotice";
import { fr } from "../i18n/fr";

const createSteps = [
  {
    icon: Camera,
    ...fr.create.steps.photo,
  },
  {
    icon: ScanSearch,
    ...fr.create.steps.review,
  },
  {
    icon: CheckCircle2,
    ...fr.create.steps.publish,
  },
] as const;

export function CreatePage() {
  const navigate = useNavigate();

  return (
    <div className="ui2-root ob2-create-page">
      <a className="ob2-skip-link" href="#contenu">{fr.common.skipToContent}</a>
      <header className="ob2-create-header">
        <div className="ob2-shell">
          <Link to="/" aria-label={fr.common.brand.experimentalReturnLabel}><Brand /></Link>
          <Link className="ob2-create-back" to="/">
            <ArrowLeft aria-hidden="true" /> {fr.create.returnHome}
          </Link>
        </div>
      </header>
      <PagesDemoNotice />

      <main id="contenu" className="ob2-create-main">
        <div className="ob2-shell ob2-create-grid">
          <section className="ob2-create-copy" aria-labelledby="ob2-create-title">
            <Badge tone="warning">{fr.create.badge}</Badge>
            <p className="ob2-kicker">{fr.create.kicker}</p>
            <h1 id="ob2-create-title">{fr.create.title}</h1>
            <p className="ob2-create-intro">{fr.create.intro}</p>

            <ol className="ob2-create-steps">
              {createSteps.map(({ description, icon: Icon, label, title }) => (
                <li key={label}>
                  <span><Icon aria-hidden="true" /></span>
                  <div><small>{label}</small><h2>{title}</h2><p>{description}</p></div>
                </li>
              ))}
            </ol>

            <aside className="ob2-handoff-note" aria-labelledby="ob2-handoff-title">
              <h2 id="ob2-handoff-title">{fr.create.handoff.title}</h2>
              <p>
                {pagesDemoEnabled
                  ? fr.create.handoff.pagesDescription
                  : fr.create.handoff.description}
              </p>
            </aside>

            <div className="ob2-create-actions">
              <Button
                size="lg"
                iconTrailing={<ExternalLink aria-hidden="true" />}
                onPress={() => window.location.assign(domainLinks.originalCreate)}
              >
                {fr.create.openOriginal}
              </Button>
              <Button color="secondary" size="lg" iconLeading={<ArrowLeft aria-hidden="true" />} onPress={() => navigate("/")}>
                {fr.create.returnToExploration}
              </Button>
            </div>
          </section>

          <figure className="ob2-create-visual">
            <picture>
              <source media="(max-width: 760px)" srcSet={servicePass960Url} />
              <img src={servicePass1600Url} alt="" width="1600" height="901" />
            </picture>
            <figcaption>
              <span>{fr.create.visual.badge}</span>
              <strong>{fr.create.visual.caption}</strong>
              <ArrowRight aria-hidden="true" />
            </figcaption>
          </figure>
        </div>
      </main>
    </div>
  );
}
