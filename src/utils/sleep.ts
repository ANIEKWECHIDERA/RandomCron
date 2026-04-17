export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new Error("Sleep aborted."));
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
}
