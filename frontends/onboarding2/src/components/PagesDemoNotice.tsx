import { Badge } from "@surplasse/design-system2";

import { pagesDemoEnabled } from "../app/runtime";
import { fr } from "../i18n/fr";

export function PagesDemoNotice() {
  if (!pagesDemoEnabled) {
    return null;
  }

  return (
    <aside className="ob2-pages-demo" aria-labelledby="ob2-pages-demo-title" role="status">
      <div className="ob2-shell ob2-pages-demo-inner">
        <Badge tone="info">{fr.pagesDemo.badge}</Badge>
        <p>
          <strong id="ob2-pages-demo-title">{fr.pagesDemo.title}</strong>
          <span>{fr.pagesDemo.description}</span>
        </p>
      </div>
    </aside>
  );
}
