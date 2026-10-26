import { and, desc, eq, sql } from "drizzle-orm";
import { addresses, profiles, type AddressSnapshot } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { CustomerError } from "./errors";

export const MAX_ADDRESSES_PER_CUSTOMER = 10;

type Address = typeof addresses.$inferSelect;
type NewAddress = Omit<typeof addresses.$inferInsert, "id" | "profileId" | "createdAt" | "updatedAt" | "isDefault">;

/**
 * OWNERSHIP RULE: every query below filters on `profile_id = <authenticated profile>`
 * in the WHERE clause itself. There is no "load by id, then check owner" step to forget.
 * Someone else's address, a deleted address and a random UUID are indistinguishable:
 * all give ADDRESS_NOT_FOUND (404), so ids can't be probed.
 */
const owned = (profileId: string, addressId: string) =>
  and(eq(addresses.id, addressId), eq(addresses.profileId, profileId));

/** Serialises address changes per customer so "exactly one default" holds under concurrency. */
async function lockProfile(tx: AnyDb, profileId: string) {
  const rows = await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, profileId)).for("update");
  if (rows.length === 0) throw new CustomerError("PROFILE_NOT_FOUND", "Profile not found.");
}

export async function listAddresses(db: AnyDb, profileId: string): Promise<Address[]> {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.profileId, profileId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

export async function getOwnedAddress(db: AnyDb, profileId: string, addressId: string): Promise<Address> {
  const [a] = await db.select().from(addresses).where(owned(profileId, addressId));
  if (!a) throw new CustomerError("ADDRESS_NOT_FOUND", "Address not found.");
  return a;
}

export async function createAddress(
  db: AnyDb,
  profileId: string,
  input: NewAddress & { isDefault?: boolean },
): Promise<Address> {
  return db.transaction(async (tx) => {
    await lockProfile(tx, profileId);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(addresses)
      .where(eq(addresses.profileId, profileId));
    if (n >= MAX_ADDRESSES_PER_CUSTOMER) {
      throw new CustomerError("ADDRESS_LIMIT_REACHED", `You can save up to ${MAX_ADDRESSES_PER_CUSTOMER} addresses.`);
    }

    const { isDefault, ...fields } = input;
    const makeDefault = n === 0 || isDefault === true; // the first address is always the default
    if (makeDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.profileId, profileId), eq(addresses.isDefault, true)));
    }
    const [row] = await tx.insert(addresses).values({ ...fields, profileId, isDefault: makeDefault }).returning();
    return row;
  });
}

/**
 * `isDefault: true` makes this the default. `isDefault: false` is ignored: a customer
 * always has a default, so the way to change it is to set another address as default.
 */
export async function updateAddress(
  db: AnyDb,
  profileId: string,
  addressId: string,
  patch: Partial<NewAddress> & { isDefault?: boolean },
): Promise<Address> {
  return db.transaction(async (tx) => {
    await lockProfile(tx, profileId);
    const { isDefault, ...fields } = patch;
    const [current] = await tx.select().from(addresses).where(owned(profileId, addressId));
    if (!current) throw new CustomerError("ADDRESS_NOT_FOUND", "Address not found.");

    if (isDefault === true && !current.isDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.profileId, profileId), eq(addresses.isDefault, true)));
    }
    const changes = { ...fields, ...(isDefault === true ? { isDefault: true } : {}) };
    // e.g. a PATCH of just { isDefault: false }: nothing to change (an empty SET is an error).
    if (Object.keys(changes).length === 0) return current;

    const [row] = await tx.update(addresses).set(changes).where(owned(profileId, addressId)).returning();
    return row;
  });
}

export async function setDefaultAddress(db: AnyDb, profileId: string, addressId: string): Promise<Address> {
  return updateAddress(db, profileId, addressId, { isDefault: true });
}

/**
 * Deleting never affects past orders: orders store their own address snapshot and hold
 * no reference to this row. If the default is deleted, the most recently added
 * remaining address becomes the default.
 */
export async function deleteAddress(db: AnyDb, profileId: string, addressId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockProfile(tx, profileId);
    const [gone] = await tx.delete(addresses).where(owned(profileId, addressId)).returning();
    if (!gone) throw new CustomerError("ADDRESS_NOT_FOUND", "Address not found.");

    if (gone.isDefault) {
      const [next] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.profileId, profileId))
        .orderBy(desc(addresses.createdAt))
        .limit(1);
      if (next) await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
  });
}

/** The immutable copy stored on an order. Contains no address id by design. */
export function toSnapshot(a: Address): AddressSnapshot {
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  };
}
