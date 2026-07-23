// Full-corpus markdown for AI agents. This local renderer adds Astro's
// deployment base to every absolute link.
import {
  getIndexedEntries,
  renderEntryAsMarkdown,
} from "@cloudflare/nimbus-docs";
import { config } from "virtual:nimbus/config";
import { absoluteSiteUrl } from "@/lib/urls";

export const prerender = true;

export async function GET() {
  const entries = await getIndexedEntries();
  const lines = [`# ${config.title}`, ""];

  if (config.description) {
    lines.push(`> ${config.description}`, "");
  }

  lines.push(`Index : ${absoluteSiteUrl("/llms.txt", config.site)}`, "");

  for (const item of entries.sort((left, right) =>
    left.url.localeCompare(right.url),
  )) {
    lines.push(`# ${item.title}`, "");
    if (item.description) {
      lines.push(`> ${item.description}`, "");
    }
    lines.push(
      `Source : ${absoluteSiteUrl(item.url, config.site)} · Markdown : ${absoluteSiteUrl(item.markdownUrl, config.site)}`,
      "",
      renderEntryAsMarkdown(item.entry),
      "",
    );
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
