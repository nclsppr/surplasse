import { fileURLToPath, pathToFileURL } from "node:url";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const nimbusRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(nimbusRoot, "..");
const sourceRoot = path.join(repositoryRoot, "docs");
const destinationRoot = path.join(nimbusRoot, "src", "content", "docs");

const allowedCalloutTypes = new Set([
  "caution",
  "danger",
  "important",
  "info",
  "note",
  "tip",
  "warning",
]);

function splitFrontmatter(source, sourcePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`Missing YAML frontmatter in ${sourcePath}`);
  }

  const frontmatter = YAML.parse(match[1]);
  if (!frontmatter || typeof frontmatter !== "object") {
    throw new Error(`Invalid YAML frontmatter in ${sourcePath}`);
  }

  return {
    frontmatter,
    body: source.slice(match[0].length),
  };
}

function extractTitle(body, sourcePath) {
  const match = body.match(/^(?:\r?\n)*#\s+(.+?)\r?\n(?:\r?\n)?/);
  if (!match) {
    throw new Error(`Missing leading H1 in ${sourcePath}`);
  }

  return {
    title: match[1].trim(),
    body: body.slice(match[0].length),
  };
}

function convertCallouts(body, sourcePath) {
  const lines = body.split(/\r?\n/);
  const converted = [];
  let activeCallout = null;
  let activeFence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (activeFence === null) {
        activeFence = fenceMatch[1][0];
      } else if (activeFence === fenceMatch[1][0]) {
        activeFence = null;
      }
      converted.push(line);
      continue;
    }

    if (activeFence !== null) {
      converted.push(line);
      continue;
    }

    if (activeCallout !== null && line.trim() === "!!!") {
      converted.push(":::");
      activeCallout = null;
      continue;
    }

    const opening = line.match(/^!!!\s+([a-z]+)(?:\s+(.+))?\s*$/);
    if (opening) {
      if (activeCallout !== null) {
        throw new Error(`Nested Retype callout in ${sourcePath}`);
      }

      const [, type, title] = opening;
      if (!allowedCalloutTypes.has(type)) {
        throw new Error(`Unsupported Retype callout type "${type}" in ${sourcePath}`);
      }

      activeCallout = type;
      converted.push(`:::${type}${title ? `[${title.trim()}]` : ""}`);
      continue;
    }

    converted.push(line);
  }

  if (activeCallout !== null) {
    throw new Error(`Unclosed Retype callout in ${sourcePath}`);
  }

  return converted.join("\n");
}

function convertRetypeHeadingIds(body) {
  const lines = body.split(/\r?\n/);
  const converted = [];
  let activeFence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (activeFence === null) {
        activeFence = fenceMatch[1][0];
      } else if (activeFence === fenceMatch[1][0]) {
        activeFence = null;
      }
      converted.push(line);
      continue;
    }

    converted.push(
      activeFence === null
        ? line.replace(/^(#{1,6}\s+.+?)[ \t]+\{#[^}]+\}[ \t]*$/u, "$1")
        : line,
    );
  }

  return converted.join("\n");
}

function normalizeBasePath(value) {
  const rawBasePath = value.trim();
  if (!rawBasePath.startsWith("/")) {
    throw new Error("NIMBUS_BASE_PATH must start with '/'.");
  }
  return rawBasePath === "/" ? "" : rawBasePath.replace(/\/+$/u, "");
}

function routeForSourcePath(relativeSourcePath, basePath) {
  const normalizedSourcePath = path.posix.normalize(relativeSourcePath);
  if (
    normalizedSourcePath === ".." ||
    normalizedSourcePath.startsWith("../")
  ) {
    throw new Error(`Internal link escapes docs/: ${relativeSourcePath}`);
  }

  const basename = path.posix.basename(normalizedSourcePath);
  const isDirectoryIndex = basename === "README.md" || basename === "index.md";
  const routePath = isDirectoryIndex
    ? path.posix.dirname(normalizedSourcePath)
    : normalizedSourcePath.replace(/\.md$/u, "");
  const suffix =
    routePath === "." || routePath === "" ? "" : `${routePath}/`;

  return `${normalizeBasePath(basePath)}/${suffix}`;
}

function convertInternalLinks(body, sourcePath, basePath) {
  const markdownFilesConverted = body.replace(
    /\]\((?![a-z][a-z0-9+.-]*:|#)([^)\s]+?)\.md(#[^)\s]+)?\)/gi,
    (_match, rawTarget, fragment = "") => {
      const sourceDirectory = path.posix.dirname(sourcePath);
      const targetSourcePath = path.posix.normalize(
        path.posix.join(sourceDirectory, `${rawTarget}.md`),
      );
      return `](${routeForSourcePath(targetSourcePath, basePath)}${fragment})`;
    },
  );

  return markdownFilesConverted.replace(
    /\]\((?![a-z][a-z0-9+.-]*:|#|\/)([^)\s]*\/)(#[^)\s]+)?\)/gi,
    (_match, rawTarget, fragment = "") => {
      const sourceDirectory = path.posix.dirname(sourcePath);
      const targetSourcePath = path.posix.normalize(
        path.posix.join(sourceDirectory, rawTarget, "index.md"),
      );
      return `](${routeForSourcePath(targetSourcePath, basePath)}${fragment})`;
    },
  );
}

export function convertRetypeDocument(
  source,
  sourcePath = "document.md",
  basePath = "/",
) {
  const { frontmatter, body: rawBody } = splitFrontmatter(source, sourcePath);
  const { title, body: bodyWithoutTitle } = extractTitle(rawBody, sourcePath);
  const label =
    typeof frontmatter.label === "string" && frontmatter.label.length > 0
      ? frontmatter.label
      : title;

  const nimbusFrontmatter = {
    title,
    ...(typeof frontmatter.description === "string"
      ? { description: frontmatter.description }
      : {}),
    sidebar: {
      ...(Number.isInteger(frontmatter.order)
        ? { order: frontmatter.order }
        : {}),
      label,
    },
    noindex: true,
    searchable: true,
  };

  const body = convertInternalLinks(
    convertRetypeHeadingIds(
      convertCallouts(bodyWithoutTitle, sourcePath),
    ),
    sourcePath,
    basePath,
  ).trimEnd();

  return {
    content: `---\n${YAML.stringify(nimbusFrontmatter).trimEnd()}\n---\n\n${body}\n`,
    metadata: {
      title,
      label,
      order: Number.isInteger(frontmatter.order)
        ? frontmatter.order
        : Number.MAX_SAFE_INTEGER,
    },
  };
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

async function findFiles(root, predicate) {
  const matches = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findFiles(absolutePath, predicate)));
    } else if (entry.isFile() && predicate(absolutePath)) {
      matches.push(absolutePath);
    }
  }

  return matches;
}

export function destinationFor(sourcePath) {
  const relativePath = path.relative(sourceRoot, sourcePath);
  if (relativePath === "README.md") {
    return path.join(destinationRoot, "index.mdx");
  }
  return path.join(
    destinationRoot,
    relativePath.replace(/\.md$/u, ".mdx"),
  );
}

function syntheticIndexContent(indexData, children) {
  const label =
    typeof indexData.label === "string" && indexData.label.length > 0
      ? indexData.label
      : "Section";
  const frontmatter = {
    title: label,
    sidebar: {
      ...(Number.isInteger(indexData.order) ? { order: indexData.order } : {}),
      label,
    },
    noindex: true,
    searchable: true,
  };

  const links = children
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      return left.label.localeCompare(right.label, "fr");
    })
    .map((child) => `- [${child.label}](${child.href})`)
    .join("\n");

  return `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\nCette section rassemble les pages suivantes :\n\n${links}\n`;
}

async function writeSyntheticIndexes(pageMetadata, basePath) {
  const indexFiles = await findFiles(
    sourceRoot,
    (absolutePath) => path.basename(absolutePath) === "index.yml",
  );
  let count = 0;

  for (const indexPath of indexFiles) {
    const relativeDirectory = path.relative(
      sourceRoot,
      path.dirname(indexPath),
    );
    const existingSourceIndex = path.join(
      sourceRoot,
      relativeDirectory,
      "index.md",
    );

    if (pageMetadata.has(toPosixPath(path.relative(sourceRoot, existingSourceIndex)))) {
      continue;
    }

    const indexData = YAML.parse(await readFile(indexPath, "utf8"));
    const directoryPrefix = relativeDirectory
      ? `${toPosixPath(relativeDirectory)}/`
      : "";
    const children = [];

    for (const [relativePath, metadata] of pageMetadata) {
      if (!relativePath.startsWith(directoryPrefix)) continue;
      const childPath = relativePath.slice(directoryPrefix.length);
      if (childPath.includes("/") || childPath === "index.md") continue;
      children.push({
        ...metadata,
        href: routeForSourcePath(
          path.posix.join(directoryPrefix, childPath),
          basePath,
        ),
      });
    }

    for (const nestedIndexPath of indexFiles) {
      const nestedDirectory = path.relative(
        path.dirname(indexPath),
        path.dirname(nestedIndexPath),
      );
      if (
        !nestedDirectory ||
        nestedDirectory === "." ||
        nestedDirectory.startsWith("..") ||
        nestedDirectory.includes(path.sep)
      ) {
        continue;
      }
      const nestedData = YAML.parse(await readFile(nestedIndexPath, "utf8"));
      children.push({
        label: nestedData.label ?? nestedDirectory,
        order: Number.isInteger(nestedData.order)
          ? nestedData.order
          : Number.MAX_SAFE_INTEGER,
        href: routeForSourcePath(
          path.posix.join(
            directoryPrefix,
            toPosixPath(nestedDirectory),
            "index.md",
          ),
          basePath,
        ),
      });
    }

    const outputPath = path.join(
      destinationRoot,
      relativeDirectory,
      "index.mdx",
    );
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      syntheticIndexContent(indexData, children),
      "utf8",
    );
    count += 1;
  }

  return count;
}

export async function syncContent() {
  const basePath = process.env.NIMBUS_BASE_PATH;
  if (!basePath) {
    throw new Error("NIMBUS_BASE_PATH is required to generate Nimbus links.");
  }
  const normalizedBasePath = normalizeBasePath(basePath);
  const expectedDestination = path.join(
    repositoryRoot,
    "docs-nimbus",
    "src",
    "content",
    "docs",
  );
  if (destinationRoot !== expectedDestination) {
    throw new Error(`Refusing to clear unexpected path: ${destinationRoot}`);
  }

  await rm(destinationRoot, { recursive: true, force: true });
  await mkdir(destinationRoot, { recursive: true });

  const sourceFiles = await findFiles(
    sourceRoot,
    (absolutePath) =>
      absolutePath.endsWith(".md") &&
      path.basename(absolutePath) !== "AGENTS.md",
  );
  const pageMetadata = new Map();

  for (const sourcePath of sourceFiles) {
    const relativePath = toPosixPath(path.relative(sourceRoot, sourcePath));
    const outputPath = destinationFor(sourcePath);
    const converted = convertRetypeDocument(
      await readFile(sourcePath, "utf8"),
      relativePath,
      normalizedBasePath,
    );

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, converted.content, "utf8");
    pageMetadata.set(relativePath, converted.metadata);
  }

  const syntheticCount = await writeSyntheticIndexes(
    pageMetadata,
    normalizedBasePath,
  );
  const total = sourceFiles.length + syntheticCount;
  process.stdout.write(
    `Nimbus content: ${total} pages generated from docs/ (${syntheticCount} section indexes).\n`,
  );
  return { sourceCount: sourceFiles.length, syntheticCount, total };
}

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  await syncContent();
}
