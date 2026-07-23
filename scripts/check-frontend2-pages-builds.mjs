import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg"]);
const localDomainPattern =
  /(?:https:\/\/|["'`])(?:[a-z0-9-]+\.)*[a-z0-9-]+\.test(?=[/?:#"'`])/u;
const builds = [
  {
    name: "Onboarding2",
    directory: "frontends/onboarding2/dist",
    marker: "Démonstration statique, sans Backend.",
  },
  {
    name: "Commande2",
    directory: "frontends/commande2/dist",
    marker: "Cette carte est synthétique et réservée à la revue visuelle sur GitHub Pages.",
  },
  {
    name: "Dashboard2",
    directory: "frontends/dashboard2/dist",
    marker: "Les commandes sont fictives. Les actions modifient uniquement cet écran",
  },
];

for (const build of builds) {
  const root = resolve(repositoryRoot, build.directory);
  const files = (await listFiles(root)).filter((file) => textExtensions.has(extname(file)));
  if (files.length === 0) {
    throw new Error(`${build.name}: no Pages build files found in ${root}`);
  }

  let markerFound = false;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (localDomainPattern.test(source)) {
      throw new Error(`${build.name}: local .test value found in Pages build: ${file}`);
    }
    markerFound ||= source.includes(build.marker);
  }

  if (!markerFound) {
    throw new Error(`${build.name}: the explicit static Pages notice is missing.`);
  }
}

console.log("All UI2 Pages builds contain their static notice and no local .test value.");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}
