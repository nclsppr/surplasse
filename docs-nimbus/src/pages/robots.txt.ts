import { config } from "virtual:nimbus/config";
import { absoluteSiteUrl, withBase } from "@/lib/urls";

export const prerender = true;

export function GET() {
  const body = [
    "User-agent: *",
    `Disallow: ${withBase("/")}`,
    "",
    `Sitemap: ${absoluteSiteUrl("/sitemap-index.xml", config.site)}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
