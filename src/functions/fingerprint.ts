import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq, or, sql } from "drizzle-orm";

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

type StoredFingerprint = typeof fingerprints.$inferSelect;

const SCORE_THRESHOLD = 60;

function scoreCandidate(
	candidate: StoredFingerprint,
	data: Signals,
	ip: string | null,
): number {
	let score = 0;
	if (data.canvasHash !== "no-canvas" && candidate.canvasHash === data.canvasHash) score += 40;
	if (data.webglHash !== "no-webgl" && candidate.webglHash === data.webglHash) score += 30;
	if (candidate.hardwareHash && candidate.hardwareHash === data.hardwareHash) score += 20;
	if (candidate.screenHash && candidate.screenHash === data.screenHash) score += 10;
	if (ip && candidate.ipAddress === ip) score += 5;
	return score;
}

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

		const orConditions = [
			...(data.canvasHash && data.canvasHash !== "no-canvas"
				? [eq(fingerprints.canvasHash, data.canvasHash)]
				: []),
			...(data.webglHash && data.webglHash !== "no-webgl"
				? [eq(fingerprints.webglHash, data.webglHash)]
				: []),
			...(data.hardwareHash ? [eq(fingerprints.hardwareHash, data.hardwareHash)] : []),
			...(data.screenHash ? [eq(fingerprints.screenHash, data.screenHash)] : []),
			...(ip ? [eq(fingerprints.ipAddress, ip)] : []),
		];

		if (orConditions.length > 0) {
			const candidates = await db
				.select()
				.from(fingerprints)
				.where(or(...orConditions));

			let best: { candidate: StoredFingerprint; score: number } | null = null;
			for (const candidate of candidates) {
				const score = scoreCandidate(candidate, data, ip);
				if (score >= SCORE_THRESHOLD && (!best || score > best.score)) {
					best = { candidate, score };
				}
			}

			if (best) {
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
					.where(eq(fingerprints.id, best.candidate.id))
					.returning();
				return {
					is_new: false,
					visitorId: updated.fingerprint,
					lastAccessed: updated.lastAccessedAt,
					numberOfTimesAccessed: updated.accessCount,
					matchedBy: "scored" as const,
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
