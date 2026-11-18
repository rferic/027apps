/** Outcome of the web redemption action; the client only navigates on `ok`. */
export type SubmitInvitationResult =
  | {
      ok: true;
      /** Effective role of the profile, which decides panel or welcome. */
      role: "super_admin" | "admin" | "user";
      /** The account was redeemed but the automatic sign-in failed. */
      signInFailed?: boolean;
    }
  | { ok: false; code: string };
