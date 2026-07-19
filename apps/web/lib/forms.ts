/** Convert a blank/whitespace-only string to null (for optional API fields). */
export function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
