import { ResponseError } from "@surplasse/shared";

const ORDER_INTAKE_PROBLEM_ROOT = import.meta.env.VITE_PROBLEM_TYPE_BASE;

const reasonsByType = {
  [`${ORDER_INTAKE_PROBLEM_ROOT}order-intake-establishment-not-active`]:
    "establishment_not_active",
  [`${ORDER_INTAKE_PROBLEM_ROOT}order-intake-configuration-unavailable`]:
    "configuration_unavailable",
  [`${ORDER_INTAKE_PROBLEM_ROOT}order-intake-payments-unavailable`]:
    "payments_unavailable",
} as const;

export type OrderIntakeUpdateProblemReason =
  | (typeof reasonsByType)[keyof typeof reasonsByType]
  | "prerequisites_unavailable";

export class OrderIntakeUpdateProblem extends Error {
  constructor(readonly reason: OrderIntakeUpdateProblemReason) {
    super("Order intake cannot be reopened.");
    this.name = "OrderIntakeUpdateProblem";
  }
}

export async function normalizeOrderIntakeUpdateError(error: unknown): Promise<unknown> {
  if (!(error instanceof ResponseError) || error.response.status !== 422) {
    return error;
  }

  try {
    const problem = (await error.response.clone().json()) as { type?: unknown };
    const reason =
      typeof problem.type === "string" && problem.type in reasonsByType
        ? reasonsByType[problem.type as keyof typeof reasonsByType]
        : "prerequisites_unavailable";
    return new OrderIntakeUpdateProblem(reason);
  } catch {
    return new OrderIntakeUpdateProblem("prerequisites_unavailable");
  }
}
