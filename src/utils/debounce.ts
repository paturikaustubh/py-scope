/**
 * Returns a debounced version of `fn` that only fires after `delay` ms of
 * silence.  Repeated calls within the window reset the timer.
 *
 * Typed as `T` so callers keep full parameter type-checking on the wrapper.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}
