"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import type { MutationFailure } from "@/lib/mutation-result";

/**
 * Flow state shared by every creation page (`/panel/categories/new`, `/panel/keys/new`,
 * `/panel/invitations/new`). The one-time result is a plaintext secret or token the
 * Core only returns in the create response, so it lives in client state and is
 * shown once: never a URL, a cookie, storage or a log.
 */
export interface CreateFormState {
  phase: "form" | "created";
  /** Plaintext secret (API key) or token (invitation) returned once. */
  result: string | null;
  copied: boolean;
  copyFailed: boolean;
  confirmingAnother: boolean;
  submitting: boolean;
  error: MutationFailure | null;
  fieldErrors: Record<string, string[]>;
  /** `key` of the form: bumping it remounts the fields empty. */
  formKey: number;
}

export const INITIAL_CREATE_FORM_STATE: CreateFormState = {
  phase: "form",
  result: null,
  copied: false,
  copyFailed: false,
  confirmingAnother: false,
  submitting: false,
  error: null,
  fieldErrors: {},
  formKey: 0,
};

export type CreateFormAction =
  | { type: "submit" }
  | { type: "failed"; error: MutationFailure | null; fieldErrors: Record<string, string[]> }
  | { type: "created"; result: string | null }
  | { type: "copy"; ok: boolean }
  | { type: "another-requested" }
  | { type: "another-cancelled" }
  | { type: "another-confirmed" }
  | { type: "clear-field-error"; field: string }
  | { type: "reset" };

/** Back to an empty form without the previous result, errors or copy flags. */
function blankState(state: CreateFormState): CreateFormState {
  return { ...INITIAL_CREATE_FORM_STATE, formKey: state.formKey + 1 };
}

type ResetAction = Extract<
  CreateFormAction,
  { type: "another-requested" | "another-cancelled" | "another-confirmed" | "reset" }
>;

/** Leaving the created step: ask while the result is uncopied, reset otherwise. */
function resetStep(state: CreateFormState, action: ResetAction): CreateFormState {
  if (action.type === "another-cancelled") return { ...state, confirmingAnother: false };
  if (action.type === "another-requested" && state.result && !state.copied) {
    return { ...state, confirmingAnother: true };
  }
  return blankState(state);
}

export function createFormReducer(
  state: CreateFormState,
  action: CreateFormAction,
): CreateFormState {
  switch (action.type) {
    case "submit":
      return { ...state, submitting: true, error: null, fieldErrors: {} };
    case "failed":
      return {
        ...state,
        submitting: false,
        error: action.error,
        fieldErrors: action.fieldErrors,
      };
    case "created":
      return {
        ...state,
        submitting: false,
        phase: "created",
        result: action.result,
        copied: false,
        copyFailed: false,
        confirmingAnother: false,
        error: null,
        fieldErrors: {},
        formKey: state.formKey + 1,
      };
    case "copy":
      return {
        ...state,
        copied: action.ok,
        copyFailed: !action.ok,
      };
    case "clear-field-error": {
      const fieldErrors = { ...state.fieldErrors };
      delete fieldErrors[action.field];
      return { ...state, fieldErrors };
    }
    default:
      return resetStep(state, action);
  }
}

/**
 * Layout effect that also runs on the server without React's SSR warning.
 * Cache Components hides a route with React `<Activity>` instead of unmounting
 * it, so client state survives a navigation; the cleanup below runs while the
 * page is hidden and clears the flow before the next visit.
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface CreateFormHandle extends Omit<CreateFormState, "formKey"> {
  dispatch: Dispatch<CreateFormAction>;
  reset: () => void;
  /**
   * React `key` for the fields subtree. It changes on every push/replace into
   * the page (`router.bfcacheId`) and on every explicit reset, so the fields
   * (and the browser's own DOM state) start empty on each visit.
   */
  formKey: string;
}

/**
 * State for a creation page. A new visit always starts from an empty form:
 * Cache Components preserves the component while another route is visible
 * (React `<Activity>`), so the flow is reset while the route is hidden, when
 * it is shown again, and whenever a new navigation creates a new segment.
 * `formKey` remounts the field subtree.
 */
export function useCreateForm(): CreateFormHandle {
  const router = useRouter();
  const [state, dispatch] = useReducer(createFormReducer, INITIAL_CREATE_FORM_STATE);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const mounted = useRef(false);

  useIsomorphicLayoutEffect(() => {
    // First mount is already blank; a later run means the route was hidden by
    // Activity and is visible again, so a stale result must not come back.
    if (mounted.current) reset();
    else mounted.current = true;
    return reset;
  }, [reset]);

  return {
    ...state,
    dispatch,
    reset,
    formKey: `${router.bfcacheId ?? ""}:${state.formKey}`,
  };
}
