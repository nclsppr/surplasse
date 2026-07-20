import { useEffect, useId, useRef, useState } from "react";
import { formatPriceCents } from "@surplasse/shared";
import type { MenuOption, MenuOptionGroup, MenuProduct } from "@surplasse/shared";

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
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-2xl border-0 bg-[var(--surface-raised)] p-0 text-[var(--text-body)] backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:rounded-2xl"
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
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="min-h-11 rounded-md border border-[var(--line-2)] px-3 text-sm font-semibold"
          >
            {fr.product.close}
          </button>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {product.name}
          </h2>
          <p className="shrink-0 font-semibold text-[var(--structure)]">
            {formatPriceCents(product.priceCents, currency)}
          </p>
        </div>
        {product.description !== undefined && (
          <p id={descriptionId} className="mt-1 text-sm text-[var(--text-muted)]">
            {product.description}
          </p>
        )}

        {product.optionGroups.map((group) => (
          <fieldset key={group.id} className="mt-4">
            <legend className="text-sm font-semibold">
              {group.name}{" "}
              <span className="font-normal text-[var(--text-muted)]">
                {group.minChoices > 0 ? `(${fr.product.required})` : `(${fr.product.chooseUpTo(group.maxChoices)})`}
              </span>
            </legend>
            <div className="mt-2 space-y-1">
              {group.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-[var(--line-1)] px-3 ${
                    pickedIn(group).includes(option.id) ? "border-[var(--accent)] bg-[var(--accent-tint)]" : ""
                  } ${option.available ? "" : "opacity-50"}`}
                >
                  <span className="flex items-center gap-2">
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
                    <span className="text-sm text-[var(--text-muted)]">
                      +{formatPriceCents(option.extraCostCents, currency)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="mt-4 block">
          <span className="sr-only">{fr.product.notePlaceholder}</span>
          <input
            type="text"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={fr.product.notePlaceholder}
            className="min-h-11 w-full rounded-md border border-[var(--line-1)] bg-[var(--surface-card)] px-3 text-sm"
          />
        </label>

        {!acceptingOrders && (
          <p className="mt-4 rounded-md border border-[var(--accent-hover)] bg-[var(--accent-tint)] p-3 text-sm">
            {fr.product.orderIntakePaused}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-md border border-[var(--line-2)] font-semibold"
          >
            {fr.product.cancel}
          </button>
          <button
            type="button"
            disabled={!satisfied || !acceptingOrders}
            onClick={submit}
            className="min-h-11 flex-1 rounded-md bg-[var(--accent)] font-semibold text-[var(--on-accent)] disabled:opacity-40"
          >
            {fr.product.addToCart}
          </button>
        </div>
      </div>
    </dialog>
  );
}
