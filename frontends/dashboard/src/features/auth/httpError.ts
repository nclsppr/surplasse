interface ErrorWithResponse {
  response?: {
    status?: unknown;
  };
}

export function httpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }

  const status = (error as ErrorWithResponse).response?.status;
  return typeof status === "number" ? status : undefined;
}

export function isUnauthorized(error: unknown): boolean {
  return httpStatus(error) === 401;
}
