import { Brand as DesignSystemBrand } from "@surplasse/design-system2";

import { fr } from "../i18n/fr";

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return <DesignSystemBrand compact={compact} tagline={fr.brand.tagline} />;
}
