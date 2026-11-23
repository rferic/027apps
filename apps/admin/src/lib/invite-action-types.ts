/** Outcome of the web redemption action; the client only navigates on `ok`. */
export type SubmitInvitationResult =
  | {
      ok: true;
      /** Effective role of the profile, which decides panel or welcome. */
      role: "super_admin" | "admin" | "user";
      /** The account was redeemed but the automatic sign-in failed. */
      signInFailed?: boolean;
      /** The invitation was applied to an account that already existed. */
      existingAccount?: true;
    }
  | { ok: false; code: string };
