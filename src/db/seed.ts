import { nanoid } from "nanoid";
import type { AppDatabase } from "./client.js";
import { shops, staffUsers } from "./schema.js";
import { hashPassword } from "../auth/password.js";

export async function seedDemoShop(db: AppDatabase): Promise<{
  shopId: string;
  staffId: string;
  staffEmail: string;
  staffPassword: string;
}> {
  const existing = await db.query.shops.findFirst();
  if (existing) {
    const staff = await db.query.staffUsers.findFirst({
      where: (u, { eq }) => eq(u.shopId, existing.id),
    });
    return {
      shopId: existing.id,
      staffId: staff?.id ?? "",
      staffEmail: staff?.email ?? "barista@demo.local",
      staffPassword: "password123",
    };
  }

  const shopId = nanoid();
  const staffId = nanoid();
  const staffEmail = "barista@demo.local";
  const staffPassword = "password123";
  const now = Date.now();

  await db.insert(shops).values({
    id: shopId,
    name: "Demo Coffee",
    slug: "demo",
    apnsTopicBundleId: "com.example.coffee.clip",
    timezone: "America/New_York",
    createdAt: now,
  });

  await db.insert(staffUsers).values({
    id: staffId,
    shopId,
    email: staffEmail,
    passwordHash: await hashPassword(staffPassword),
    role: "barista",
    createdAt: now,
  });

  return { shopId, staffId, staffEmail, staffPassword };
}
