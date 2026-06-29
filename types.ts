export type TimerHandle = ReturnType<typeof setTimeout>;

export type JsonObject = Record<string, unknown>;

export type ChatMessage = Record<string, unknown>;

export type Settings = {
	codebuffToken: string | null;
	localApiKey: string | null;
	codebuffBaseUrl: string;
	zeroclickBaseUrl: string;
	sessionId: string;
	clientId: string;
	adProviders: string[];
	requestTimeoutSeconds: number;
	debug: boolean;
	logBodyChars: number;
	host: string;
	port: number;
	proxyEnabled: boolean;
	proxyUrl: string | null;
	timezone: string;
	locale: string;
	osName: string;
};

export type FreebuffSession = {
	instanceId: string;
	model: string;
	expiresAt?: string | null;
	remainingMs?: number | null;
};

export type FreebuffRun = {
	runId: string;
	agentId: string;
	startedAt: string;
	childRunId?: string | null;
	chatRunId?: string | null;
	chatStartedAt?: string | null;
};

export type FreebuffModel = {
	id: string;
	agentId: string;
	ownedBy: string;
	upstreamModelId?: string | null;
	sessionModelId?: string | null;
	parentAgentId?: string | null;
};
