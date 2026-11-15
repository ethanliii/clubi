import { useMutation } from "convex/react";
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";
import { useCallback, useState } from "react";
import { useToast } from "../components/Toast";
import { errorMessage } from "./errors";

export type MutationToastOptions = {
  /** Shown in a toast when the call works, e.g. "Saved". */
  success?: string;
  /** Shown instead of the backend's sentence when the call fails. */
  failure?: string;
};

/**
 * `useMutation` with the error handling every screen needs.
 *
 *   const { run, pending } = useMutationToast(api.saves.toggle);
 *   <Button title="Save" disabled={pending} onPress={() => run({ kind, id, type: "want" })} />
 *
 * `run` never throws. It resolves to the mutation's result, or to `undefined` after showing the
 * backend's error sentence in a toast (a mutation that "returns nothing" resolves to `null`, so
 * `result === undefined` always means it failed). `pending` is true while a call is in flight.
 */
export function useMutationToast<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  options: MutationToastOptions = {},
) {
  const mutate = useMutation(mutation);
  const toast = useToast();
  const [inFlight, setInFlight] = useState(0);
  const { success, failure } = options;

  const run = useCallback(
    async (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation> | undefined> => {
      setInFlight((count) => count + 1);
      try {
        const result = await mutate(...args);
        if (success) toast(success, "success");
        return result;
      } catch (error) {
        toast(failure ?? errorMessage(error), "error");
        return undefined;
      } finally {
        setInFlight((count) => count - 1);
      }
    },
    [mutate, toast, success, failure],
  );

  return { run, pending: inFlight > 0 };
}
