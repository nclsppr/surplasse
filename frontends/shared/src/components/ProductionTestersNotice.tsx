export type SurplasseReleaseMode = "development" | "testers" | "public";

interface ProductionTestersNoticeProps {
  mode: SurplasseReleaseMode;
}

export function ProductionTestersNotice({ mode }: ProductionTestersNoticeProps) {
  if (mode === "development" || mode === "public") {
    return null;
  }

  return (
    <aside
      className="production-testers-notice"
      aria-label="Information sur la production réservée aux testeurs"
      role="note"
    >
      <strong>Production réservée aux testeurs</strong>
      <span>
        Commandes et données de test uniquement. Stripe ne débite aucune carte bancaire réelle.
      </span>
    </aside>
  );
}
