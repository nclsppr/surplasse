import { ResponseError } from "@surplasse/shared";

const ORDER_INTAKE_PAUSED_TYPE = `${import.meta.env.VITE_PROBLEM_TYPE_BASE}order-intake-paused`;

export async function isOrderIntakePausedProblem(error: unknown): Promise<boolean> {
  if (!(error instanceof ResponseError) || error.response.status !== 409) {
    return false;
  }

  try {
    const problem = (await error.response.clone().json()) as { type?: unknown };
    return problem.type === ORDER_INTAKE_PAUSED_TYPE;
  } catch {
    return false;
  }
}
