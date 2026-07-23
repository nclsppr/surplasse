import { Badge, Button } from "@surplasse/design-system2";
import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";

import { fr } from "../i18n/fr";

const serviceStates = [
  { id: "paid", ...fr.serviceDemo.states.paid },
  { id: "accepted", ...fr.serviceDemo.states.accepted },
  { id: "preparing", ...fr.serviceDemo.states.preparing },
  { id: "ready", ...fr.serviceDemo.states.ready },
  { id: "served", ...fr.serviceDemo.states.served },
] as const;

export function ServiceDemo() {
  const [stateIndex, setStateIndex] = useState(0);
  const state = serviceStates[stateIndex];
  const completed = stateIndex === serviceStates.length - 1;

  return (
    <div className="ob2-service-console" data-state={state.id}>
      <div className="ob2-console-topline">
        <div>
          <span>{fr.serviceDemo.orderNumber}</span>
          <strong>{fr.serviceDemo.table}</strong>
        </div>
        <Badge tone="success" dot>{fr.serviceDemo.paymentConfirmed}</Badge>
      </div>

      <div className="ob2-order-body">
        <div className="ob2-order-lines" aria-label={fr.serviceDemo.orderContentsLabel}>
          {fr.serviceDemo.lines.map((line) => (
            <p key={line.product}>
              <strong>{line.quantity}</strong><span>{line.product}</span><span>{line.price}</span>
            </p>
          ))}
        </div>
        <div className="ob2-order-total">
          <span>{fr.serviceDemo.totalPaid}</span><strong>{fr.serviceDemo.total}</strong>
        </div>
      </div>

      <ol className="ob2-status-track" aria-label={fr.serviceDemo.progressLabel}>
        {serviceStates.map((item, index) => (
          <li key={item.id} data-active={index <= stateIndex || undefined} aria-current={index === stateIndex ? "step" : undefined}>
            <span>{index < stateIndex ? <Check aria-hidden="true" /> : index + 1}</span>
            {item.short}
          </li>
        ))}
      </ol>

      <div className="ob2-console-action">
        <p aria-live="polite">{fr.serviceDemo.currentStatus} <strong>{state.label}</strong></p>
        <Button
          size="lg"
          iconLeading={completed ? <RotateCcw aria-hidden="true" /> : undefined}
          onPress={() => setStateIndex(completed ? 0 : stateIndex + 1)}
        >
          {state.action}
        </Button>
      </div>
    </div>
  );
}
