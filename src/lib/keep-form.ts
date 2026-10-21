import { startTransition, type FormEvent } from "react";

/**
 * onSubmit handler that runs a form action without React 19's automatic form reset, so a
 * validation error ("Email or password is incorrect") doesn't wipe what the user typed.
 * Forms that should clear after success (add staff, add customer) reset themselves explicitly.
 */
export function keep(action: (f: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(f));
  };
}
