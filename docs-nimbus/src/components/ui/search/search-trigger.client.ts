/** Adapte le raccourci de recherche à la plateforme active. */

import { mount } from "@cloudflare/nimbus-docs/client";

mount("[data-search-trigger]", (button) => {
  const navigatorWithPlatform = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = navigatorWithPlatform.userAgentData?.platform ?? "";
  const isMac = platform
    ? /mac/i.test(platform)
    : /mac|iphone|ipod|ipad/i.test(navigator.userAgent);
  if (isMac) {
    button.setAttribute("aria-keyshortcuts", "Meta+K");
    const key = button.querySelector("[data-shortcut-key]");
    if (key) key.textContent = "⌘";
  }
  return () => {};
});
