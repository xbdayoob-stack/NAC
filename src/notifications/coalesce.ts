const pending = new Map<
  string,
  { timer: NodeJS.Timeout; resolve: () => void }
>();

const defaultWindow =
  Number(process.env.COALESCE_MS ?? "2500") || 2500;

export function debounceOrderNotify(
  orderId: string,
  windowMs = defaultWindow,
): Promise<void> {
  return new Promise((resolve) => {
    const existing = pending.get(orderId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.resolve();
    }
    const timer = setTimeout(() => {
      pending.delete(orderId);
      resolve();
    }, windowMs);
    pending.set(orderId, { timer, resolve });
  });
}

export function clearCoalesceState(): void {
  for (const { timer, resolve } of pending.values()) {
    clearTimeout(timer);
    resolve();
  }
  pending.clear();
}
