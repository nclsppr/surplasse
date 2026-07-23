import { Badge, Button } from "@surplasse/design-system2";
import { RefreshCw } from "lucide-react";

import { fr } from "../../i18n/fr";

export function PausedPaymentNotice({ onRetry }: { onRetry(): void }) {
  return (
    <div
      className="payment-notice"
      role="alert"
    >
      <Badge tone="warning">{fr.menu.orderIntakeTitle}</Badge>
      <p>{fr.payment.orderIntakePaused}</p>
      <Button
        color="secondary"
        size="sm"
        iconLeading={<RefreshCw aria-hidden="true" />}
        onPress={onRetry}
      >
        {fr.payment.retry}
      </Button>
    </div>
  );
}
