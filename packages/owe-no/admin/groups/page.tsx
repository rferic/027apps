/** OweNo groups: the panel's list and detail entry point. */
export default async function OweNoGroups() {
  return (
    <section aria-labelledby="owe-no-groups" className="flex flex-col gap-3">
      <h1 id="owe-no-groups" className="text-base font-bold">
        Groups
      </h1>
      <p className="text-xs text-muted-foreground">
        Every group with its members and balances. Editing a group is an admin
        action; members manage their own movements from the app.
      </p>
    </section>
  );
}
