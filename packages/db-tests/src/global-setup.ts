import { withClient } from "./pg.js";

/**
 * The suite creates accounts through the app's own pool in a few files (auth,
 * devices, api), so those rows commit instead of rolling back. They are all
 * `@test.local`, and leaving them behind fills the developer's members list with
 * "Test User" accounts that look like real people. The teardown removes them
 * after the whole run; the transactional tests are unaffected.
 */
export async function teardown(): Promise<void> {
  try {
    await withClient(async (c) => {
      await c.query(
        `delete from public.api_keys
          where created_by in (select id from auth.users where email like '%@test.local')`,
      );
      await c.query("delete from auth.users where email like '%@test.local'");
    });
  } catch (error) {
    // A teardown failure must not turn a green suite red; it only means the
    // local stack was already gone.
    console.warn("db-tests teardown could not remove @test.local accounts", error);
  }
}
