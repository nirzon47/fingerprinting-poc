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
};

function Home() {
	const [result, setResult] = useState<ApiResult | null>(null);

	useEffect(() => {
		FingerprintJS.load()
			.then((agent) => agent.get())
			.then(({ visitorId }) => upsertFingerprint({ data: { visitorId } }))
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
