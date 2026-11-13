/** For tests that call an actor's hooks and actions in this process, with a context built by hand. */

/** A connection and the `vars.callers` that says who it is, as `onConnect` leaves them. */
export function connOf(caller: object, id = "conn") {
  return { conn: { id, send: (): void => {} }, callers: new Map([[id, caller]]) };
}

/** `vars.kept` for a context whose `vars.state` the test holds itself: nothing is written. */
export const unsaved = { save: async (): Promise<void> => {} };
