import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "#/db/index";
import { fingerprints } from "#/db/schema";

type Signals = {
	visitorId: string;
	canvasHash: string;
	webglHash: string;
	audioHash?: string;
	screenHash: string;
	hardwareHash: string;
};

export const upsertFingerprint = createServerFn({ method: "POST" })
	.inputValidator((data: Signals) => {
		if (!data?.visitorId || typeof data.visitorId !== "string") {
			throw new Error("visitorId required");
		}
		return data;
	})
	.handler(async ({ data }) => {
		const request = getRequest();
		const ip =
			request?.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
			request?.headers.get("x-real-ip") ||
			null;

		const [exact] = await db
			.select()
			.from(fingerprints)
			.where(eq(fingerprints.fingerprint, data.visitorId))
			.limit(1);

		if (exact) {
			const [updated] = await db
				.update(fingerprints)
				.set({
					canvasHash: data.canvasHash,
					webglHash: data.webglHash,
					screenHash: data.screenHash,
					hardwareHash: data.hardwareHash,
					accessCount: sql`${fingerprints.accessCount} + 1`,
					lastAccessedAt: new Date(),
					ipAddress: ip,
				})
				.where(eq(fingerprints.id, exact.id))
				.returning();
			return {
				is_new: false,
				visitorId: updated.fingerprint,
				lastAccessed: updated.lastAccessedAt,
				numberOfTimesAccessed: updated.accessCount,
				matchedBy: "exact" as const,
			};
		}

		const canFuzzyMatch =
			data.canvasHash &&
			data.webglHash &&
			data.canvasHash !== "no-canvas" &&
			data.webglHash !== "no-webgl";

		if (canFuzzyMatch) {
			const [fuzzy] = await db
				.select()
				.from(fingerprints)
				.where(
					and(
						eq(fingerprints.canvasHash, data.canvasHash),
						eq(fingerprints.webglHash, data.webglHash),
						isNotNull(fingerprints.canvasHash),
						isNotNull(fingerprints.webglHash),
					),
				)
				.limit(1);

			if (fuzzy) {
				const [updated] = await db
					.update(fingerprints)
					.set({
						fingerprint: data.visitorId,
						canvasHash: data.canvasHash,
						webglHash: data.webglHash,
						audioHash: data.audioHash,
						screenHash: data.screenHash,
						hardwareHash: data.hardwareHash,
						accessCount: sql`${fingerprints.accessCount} + 1`,
						lastAccessedAt: new Date(),
						ipAddress: ip,
					})
					.where(eq(fingerprints.id, fuzzy.id))
					.returning();
				return {
					is_new: false,
					visitorId: updated.fingerprint,
					lastAccessed: updated.lastAccessedAt,
					numberOfTimesAccessed: updated.accessCount,
					matchedBy: "canvas+webgl" as const,
				};
			}
		}

		const [record] = await db
			.insert(fingerprints)
			.values({
				fingerprint: data.visitorId,
				canvasHash: data.canvasHash,
				webglHash: data.webglHash,
				audioHash: data.audioHash,
				screenHash: data.screenHash,
				hardwareHash: data.hardwareHash,
				ipAddress: ip,
			})
			.returning();

		return {
			is_new: true,
			visitorId: record.fingerprint,
			lastAccessed: record.lastAccessedAt,
			numberOfTimesAccessed: record.accessCount,
			matchedBy: "none" as const,
		};
	});
