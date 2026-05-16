import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { upsertFingerprint } from "#/functions/fingerprint";

export const Route = createFileRoute("/")({ component: Home });

type ApiResult = {
	is_new: boolean;
	visitorId: string;
	lastAccessed: Date;
	numberOfTimesAccessed: number;
	matchedBy: "exact" | "canvas+webgl" | "none";
};

async function sha256(str: string): Promise<string> {
	const buf = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(str),
	);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 16);
}

async function getCanvasHash(): Promise<string> {
	const canvas = document.createElement("canvas");
	canvas.width = 200;
	canvas.height = 50;
	const ctx = canvas.getContext("2d");
	if (!ctx) return "no-canvas";
	ctx.textBaseline = "top";
	ctx.font = "14px Arial";
	ctx.fillStyle = "#f60";
	ctx.fillRect(125, 1, 62, 20);
	ctx.fillStyle = "#069";
	ctx.fillText("fingerprinting poc text scrambled sv sv poc poc", 2, 15);
	ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
	ctx.fillText("fingerprinting poc text scrambled sv sv poc poc", 4, 17);
	return sha256(canvas.toDataURL());
}

async function getWebGLHash(): Promise<string> {
	const canvas = document.createElement("canvas");
	const gl = (canvas.getContext("webgl") ||
		canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
	if (!gl) return "no-webgl";
	const ext = gl.getExtension("WEBGL_debug_renderer_info");
	return sha256(
		[
			gl.getParameter(gl.RENDERER),
			gl.getParameter(gl.VENDOR),
			ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "",
			ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "",
		].join("|"),
	);
}

async function getAudioHash(): Promise<string> {
	try {
		const AudioCtx =
			window.AudioContext ||
			(window as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AudioCtx) return "no-audio";
		const ctx = new AudioCtx();
		await ctx.resume();
		const oscillator = ctx.createOscillator();
		const analyser = ctx.createAnalyser();
		const gainNode = ctx.createGain();
		gainNode.gain.value = 0;
		oscillator.type = "triangle";
		oscillator.connect(analyser);
		analyser.connect(gainNode);
		gainNode.connect(ctx.destination);
		oscillator.start(0);
		return new Promise<string>((resolve) => {
			setTimeout(() => {
				const buffer = new Float32Array(analyser.fftSize);
				analyser.getFloatTimeDomainData(buffer);
				try {
					oscillator.stop();
					ctx.close();
				} catch {}
				sha256(Array.from(buffer.slice(0, 50)).join(",")).then(resolve);
			}, 100);
		});
	} catch {
		return "no-audio";
	}
}

async function getScreenHash(): Promise<string> {
	return sha256(
		[
			screen.width,
			screen.height,
			screen.colorDepth,
			screen.pixelDepth,
			window.devicePixelRatio,
			screen.availWidth,
			screen.availHeight,
		].join("|"),
	);
}

async function getHardwareHash(): Promise<string> {
	return sha256(
		[
			navigator.hardwareConcurrency,
			(navigator as { deviceMemory?: number }).deviceMemory ?? "unknown",
			navigator.platform,
			navigator.language,
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		].join("|"),
	);
}

function Home() {
	const [result, setResult] = useState<ApiResult | null>(null);

	useEffect(() => {
		Promise.all([
			FingerprintJS.load()
				.then((agent) => agent.get())
				.then((r) => r.visitorId),
			getCanvasHash(),
			getWebGLHash(),
			getAudioHash(),
			getScreenHash(),
			getHardwareHash(),
		])
			.then(
				([
					visitorId,
					canvasHash,
					webglHash,
					audioHash,
					screenHash,
					hardwareHash,
				]) =>
					upsertFingerprint({
						data: {
							visitorId,
							canvasHash,
							webglHash,
							audioHash,
							screenHash,
							hardwareHash,
						},
					}),
			)
			.then(setResult);
	}, []);

	return (
		<div className="bg-zinc-900 min-h-screen text-white p-8">
			<h1 className="text-4xl font-bold mb-6">Browser Fingerprint</h1>
			{result ? (
				<>
					<p className="text-zinc-400 pb-4 text-2xl">
						You are a {result.is_new ? "new" : "returning"} visitor
					</p>
					{!result.is_new && result.matchedBy === "canvas+webgl" && (
						<p className="text-yellow-400 pb-4 text-sm">
							Identified via hardware signals (incognito detected)
						</p>
					)}
					<div className="bg-zinc-800 rounded-lg p-4 font-mono text-sm">
						<pre>{JSON.stringify(result, null, 2)}</pre>
					</div>
				</>
			) : (
				<p className="text-zinc-400">Generating fingerprint...</p>
			)}
		</div>
	);
}
