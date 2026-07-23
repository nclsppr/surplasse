import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  convertRetypeDocument,
  destinationFor,
} from "./sync-content.mjs";

test("maps Retype metadata and removes the body H1", () => {
  const source = `---
label: Accueil
order: 1
icon: home
description: La page d'accueil.
---

# Surplasse

Contenu.
`;

  const result = convertRetypeDocument(source, "README.md", "/preview");

  assert.match(result.content, /^---\ntitle: Surplasse\n/);
  assert.match(result.content, /description: La page d'accueil\./);
  assert.match(result.content, /sidebar:\n  order: 1\n  label: Accueil/);
  assert.match(result.content, /noindex: true\nsearchable: true/);
  assert.doesNotMatch(result.content, /icon:/);
  assert.doesNotMatch(result.content, /^# Surplasse$/m);
  assert.match(result.content, /\nContenu\.\n$/);
});

test("converts Retype callouts and Markdown file links", () => {
  const source = `---
label: Exemple
description: Exemple de conversion.
---

# Exemple

!!! warning Règle importante
Lire [la décision](../decisions/index.md#statut), [les décisions](../decisions/) et [l'accueil](../README.md).
!!!
`;

  const result = convertRetypeDocument(
    source,
    "guides/exemple.md",
    "/preview",
  );

  assert.match(
    result.content,
    /:::warning\[Règle importante\]\nLire \[la décision\]\(\/preview\/decisions\/#statut\), \[les décisions\]\(\/preview\/decisions\/\) et \[l'accueil\]\(\/preview\/\)\.\n:::/,
  );
});

test("removes Retype heading ids that MDX would parse as expressions", () => {
  const source = `---
label: Exemple
---

# Exemple

## Section stable {#section-stable}

\`\`\`md
## Marqueur littéral {#marqueur-litteral}
\`\`\`
`;

  const result = convertRetypeDocument(source, "exemple.md", "/preview");

  assert.match(result.content, /^## Section stable$/m);
  assert.doesNotMatch(result.content, /^## Section stable \{#section-stable\}$/m);
  assert.match(result.content, /^## Marqueur littéral \{#marqueur-litteral\}$/m);
});

test("writes the derived collection as MDX so Nimbus transforms directives", () => {
  assert.match(
    destinationFor(path.resolve("../docs/README.md")),
    /src\/content\/docs\/index\.mdx$/u,
  );
  assert.match(
    destinationFor(path.resolve("../docs/architecture/api.md")),
    /src\/content\/docs\/architecture\/api\.mdx$/u,
  );
});

test("does not rewrite Retype markers inside fenced code", () => {
  const source = `---
label: Exemple
---

# Exemple

\`\`\`text
!!! warning Exemple littéral
!!!
\`\`\`
`;

  const result = convertRetypeDocument(source, "exemple.md", "/preview");

  assert.match(result.content, /!!! warning Exemple littéral\n!!!/);
  assert.doesNotMatch(result.content, /:::warning/);
});

test("rejects malformed Retype documents", () => {
  assert.throws(
    () => convertRetypeDocument("# Sans front matter\n", "bad.md", "/preview"),
    /Missing YAML frontmatter/,
  );

  assert.throws(
    () =>
      convertRetypeDocument(
        `---
label: Sans titre
---

Texte.
        `,
        "bad.md",
        "/preview",
      ),
    /Missing leading H1/,
  );
});
