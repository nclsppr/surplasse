import { useEffect, useId, useRef, useState } from "react";
import { formatPriceCents } from "@surplasse/shared";
import type { MenuOption, MenuOptionGroup, MenuProduct } from "@surplasse/shared";
import { Badge, Button } from "@surplasse/design-system2";
import { ShoppingBag, X } from "lucide-react";

import { fr } from "../../../i18n/fr";
import type { CartOption } from "../../cart/hooks/useCart";

type Props = {
  product: MenuProduct;
  currency: string;
  acceptingOrders: boolean;
  onAdd: (options: CartOption[], note: string | undefined) => void;
  onClose: () => void;
};

/** Option picking sheet: mandatory groups block the add until satisfied. */
export function ProductSheet({ product, currency, acceptingOrders, onAdd, onClose }: Props) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog === null) {
      return;
    }

    dialog.showModal();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  const pickedIn = (group: MenuOptionGroup) => picked[group.id] ?? [];

  const toggle = (group: MenuOptionGroup, option: MenuOption) => {
    const current = pickedIn(group);
    if (group.maxChoices === 1) {
      setPicked({ ...picked, [group.id]: current[0] === option.id ? [] : [option.id] });
      return;
    }
    if (current.includes(option.id)) {
      setPicked({ ...picked, [group.id]: current.filter((id) => id !== option.id) });
    } else if (current.length < group.maxChoices) {
      setPicked({ ...picked, [group.id]: [...current, option.id] });
    }
  };

  const satisfied = product.optionGroups.every((group) => {
    const count = pickedIn(group).length;
    return count >= group.minChoices && count <= group.maxChoices;
  });

  const submit = () => {
    const options: CartOption[] = product.optionGroups.flatMap((group) =>
      group.options
        .filter((option) => pickedIn(group).includes(option.id))
        .map((option) => ({
          optionId: option.id,
          group: group.name,
          option: option.name,
          extraCostCents: option.extraCostCents,
        })),
    );
    onAdd(options, note.trim() === "" ? undefined : note.trim());
  };

  return (
    <dialog
      ref={dialogRef}
      aria-describedby={product.description === undefined ? undefined : descriptionId}
      aria-labelledby={titleId}
      className="product-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="product-dialog-scroll">
        <div className="dialog-topbar">
          <Badge tone="neutral">{fr.menu.poweredBy}</Badge>
          <Button
            autoFocus
            aria-label={fr.product.close}
            className="dialog-close"
            color="tertiary"
            size="sm"
            iconLeading={<X aria-hidden="true" />}
            onPress={onClose}
          >
            {fr.product.close}
          </Button>
        </div>
        <div className="dialog-heading">
          <h2 id={titleId}>
            {product.name}
          </h2>
          <p>
            {formatPriceCents(product.priceCents, currency)}
          </p>
        </div>
        {product.description !== undefined && (
          <p id={descriptionId} className="dialog-description">
            {product.description}
          </p>
        )}

        {product.optionGroups.map((group) => (
          <fieldset key={group.id} className="option-group">
            <legend>
              {group.name}{" "}
              <span>
                {group.minChoices > 0 ? `(${fr.product.required})` : `(${fr.product.chooseUpTo(group.maxChoices)})`}
              </span>
            </legend>
            <div className="option-list">
              {group.options.map((option) => (
                <label
                  key={option.id}
                  className={`option-row ${
                    pickedIn(group).includes(option.id) ? "option-row-selected" : ""
                  } ${option.available ? "" : "option-row-disabled"}`}
                >
                  <span className="option-name">
                    <input
                      type={group.maxChoices === 1 ? "radio" : "checkbox"}
                      name={group.id}
                      checked={pickedIn(group).includes(option.id)}
                      disabled={!option.available}
                      onChange={() => toggle(group, option)}
                    />
                    {option.name}
                  </span>
                  {option.extraCostCents > 0 && (
                    <span className="option-price">
                      +{formatPriceCents(option.extraCostCents, currency)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="note-field">
          <span className="sr-only">{fr.product.notePlaceholder}</span>
          <input
            type="text"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={fr.product.notePlaceholder}
            className="note-input"
          />
        </label>

        {!acceptingOrders && (
          <p className="dialog-warning" role="status">
            {fr.product.orderIntakePaused}
          </p>
        )}

        <div className="dialog-actions">
          <Button
            className="dialog-action"
            color="secondary"
            size="lg"
            onPress={onClose}
          >
            {fr.product.cancel}
          </Button>
          <Button
            className="dialog-action"
            size="lg"
            iconLeading={<ShoppingBag aria-hidden="true" />}
            isDisabled={!satisfied || !acceptingOrders}
            onPress={submit}
          >
            {fr.product.addToCart}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
