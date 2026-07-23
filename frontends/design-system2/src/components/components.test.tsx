import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "./Badge";
import { Brand } from "./Brand";
import { Button } from "./Button";
import { Field } from "./Field";
import { Status, initials } from "./Status";

describe("Badge", () => {
  it("keeps its text accessible while treating its status dot as decorative", () => {
    const { container } = render(<Badge dot tone="success">Service ouvert</Badge>);

    expect(screen.getByText("Service ouvert").classList).toContain("ui2-badge-success");
    expect(container.querySelector(".ui2-badge-dot")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Brand", () => {
  it("uses the canonical accessible name and removes the tagline in compact mode", () => {
    const { rerender } = render(<Brand tagline="Le circuit court de la commande" />);

    expect(screen.getByRole("img", { name: "Surplasse" })).not.toBeNull();
    expect(screen.getByText("Le circuit court de la commande")).not.toBeNull();

    rerender(<Brand compact tagline="Le circuit court de la commande" />);
    expect(screen.queryByText("Le circuit court de la commande")).toBeNull();
  });
});

describe("Button", () => {
  it("exposes its accessible name and forwards activation through React Aria", () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Accepter la commande</Button>);

    const button = screen.getByRole("button", { name: "Accepter la commande" });
    button.focus();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("prevents activation and hides its progress indicator from the accessible name while loading", () => {
    const onPress = vi.fn();
    const { container } = render(
      <Button isLoading onPress={onPress}>
        Publier la carte
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Publier la carte" });
    expect(button.matches(":disabled")).toBe(true);
    expect(container.querySelector(".ui2-spinner[aria-hidden='true']")).not.toBeNull();

    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Field", () => {
  it("associates a persistent label and description with the input", () => {
    render(
      <Field
        label="Adresse e-mail"
        description="Le lien expire après quinze minutes."
        type="email"
        isRequired
      />,
    );

    const input = screen.getByRole("textbox", { name: "Adresse e-mail" });
    const description = screen.getByText("Le lien expire après quinze minutes.");

    expect(input.matches(":required")).toBe(true);
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(description.id);
  });

  it("connects an invalid field to its error message", () => {
    render(
      <Field
        label="Nom du restaurant"
        errorMessage="Le nom est obligatoire."
        isInvalid
      />,
    );

    const input = screen.getByRole("textbox", { name: "Nom du restaurant" });
    const error = screen.getByText("Le nom est obligatoire.");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
  });
});

describe("Status", () => {
  it("announces connection state and derives compact French initials", () => {
    render(<Status state="connecting">Reconnexion en cours</Status>);

    expect(screen.getByRole("status").textContent).toContain("Reconnexion en cours");
    expect(initials("  élise dupré  ")).toBe("ÉD");
  });
});
