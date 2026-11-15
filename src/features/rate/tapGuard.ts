/**
 * Stops one tap from counting twice. When a card or a round changes under the user's thumb, a
 * double tap would answer the next one too: `mark()` when the screen moves on, and ignore any tap
 * while `justMoved()` is true. Call both from event handlers only.
 */
export type TapGuard = { mark: () => void; justMoved: () => boolean };

export function createTapGuard(quietMs: number = 350): TapGuard {
  let movedAt = 0;
  return {
    mark: () => {
      movedAt = Date.now();
    },
    justMoved: () => Date.now() - movedAt < quietMs,
  };
}
