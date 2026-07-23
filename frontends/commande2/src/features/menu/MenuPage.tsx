import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatPriceCents } from "@surplasse/shared";
import {
  Badge,
  Button,
} from "@surplasse/design-system2";
import { MapPin, ShoppingBag } from "lucide-react";

import { storedTableSession } from "../../app/tableSession";
import { pagesDemoEnabled } from "../../app/api";
import { SiteHeader } from "../../components/SiteHeader";
import { fr } from "../../i18n/fr";
import { cartTotalCents, useCart } from "../cart/hooks/useCart";
import { CategorySection } from "./components/CategorySection";
import { useEstablishment } from "./hooks/useEstablishment";
import { useMenu } from "./hooks/useMenu";

type Props = {
  slug: string;
};

export function MenuPage({ slug }: Props) {
  const establishment = useEstablishment(slug);
  const menu = useMenu(slug);
  const { lines } = useCart();
  const tableSession = storedTableSession();

  useEffect(() => {
    if (establishment.data) {
      document.title = establishment.data.name;
    }
  }, [establishment.data]);

  if (establishment.isPending || menu.isPending) {
    return (
      <main className="loading-page" aria-busy="true">
        <p className="sr-only">{fr.menu.loading}</p>
        <div className="loading-composition motion-safe:animate-pulse" aria-hidden="true">
          <div className="loading-band" />
          <div className="loading-title" />
          <div className="loading-row" />
          <div className="loading-row" />
        </div>
      </main>
    );
  }

  if (!establishment.data || !menu.data) {
    return (
      <div className="commande-page">
        <SiteHeader />
        <main className="state-page state-page-centered">
          <p className="state-title">{fr.menu.error}</p>
          <Button
            size="lg"
            onPress={() => {
            void establishment.refetch();
            void menu.refetch();
          }}
          >
            {fr.menu.retry}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="commande-page">
      <SiteHeader />
      <main className="menu-page">
        <header className="restaurant-hero">
          <div className="restaurant-hero-media" aria-hidden="true" />
          <div className="restaurant-identity">
            {tableSession !== undefined ? (
              <Badge tone="neutral" dot>
                {tableSession.tableLabel}
              </Badge>
            ) : null}
            <h1>{establishment.data.name}</h1>
            {establishment.data.address !== undefined ? (
              <p className="restaurant-address">
                <MapPin aria-hidden="true" size={17} />
                <span>{establishment.data.address}</span>
              </p>
            ) : null}
          </div>
        </header>

        <div className="menu-content">
          {pagesDemoEnabled ? (
            <section className="status-notice status-notice-neutral" role="status">
              <Badge tone="info">{fr.menu.pagesDemoBadge}</Badge>
              <p>{fr.menu.pagesDemoDescription}</p>
            </section>
          ) : null}

          {establishment.isError && (
            <p className="status-notice status-notice-neutral" role="status">
              {fr.menu.orderIntakeRefreshError}
            </p>
          )}

          {!establishment.data.acceptingOrders && (
            <section
              className="status-notice status-notice-warning"
              aria-labelledby="order-intake-paused-title"
              role="status"
            >
              <Badge tone="warning">{fr.menu.orderIntakeTitle}</Badge>
              <h2 id="order-intake-paused-title">{fr.menu.orderIntakePaused}</h2>
              <p>{fr.menu.orderIntakePausedDescription}</p>
            </section>
          )}

          <div className="menu-categories">
            {menu.data.categories.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                currency={menu.data.currency}
                acceptingOrders={establishment.data.acceptingOrders}
              />
            ))}
          </div>

          <footer className="menu-footer">{fr.menu.poweredBy}</footer>
        </div>

        {lines.length > 0 && (
          <Link to="/panier" className="cart-dock">
            <span className="cart-dock-label">
              <ShoppingBag aria-hidden="true" size={20} />
              <span>
                {fr.cart.title} · {lines.reduce((sum, line) => sum + line.quantity, 0)}
              </span>
            </span>
            <span>{formatPriceCents(cartTotalCents(lines), "EUR")}</span>
          </Link>
        )}
      </main>
    </div>
  );
}
