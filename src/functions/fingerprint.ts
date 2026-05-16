import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";

import { db } from "#/db/index";
import { fingerprints } from "#/db/schema";

export const upsertFingerprint = createServerFn({ method: "POST" })
	.inputValidator((data: { visitorId: string }) => {
		if (!data?.visitorId || typeof data.visitorId !== "string") {
			throw new Error("visitorId required");
		}
		return data;
	})
	.handler(async ({ data }) => {
		const [record] = await db
			.insert(fingerprints)
			.values({ fingerprint: data.visitorId })
			.onConflictDoUpdate({
				target: fingerprints.fingerprint,
				set: {
					accessCount: sql`${fingerprints.accessCount} + 1`,
					lastAccessedAt: new Date(),
				},
			})
			.returning();

		return {
			is_new: record.accessCount === 1,
			visitorId: record.fingerprint,
			lastAccessed: record.lastAccessedAt,
			numberOfTimesAccessed: record.accessCount,
		};
	});
