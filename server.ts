import {
	buildUpstreamPayload,
	checkLocalAuth,
	chunkNeedsToolFollowup,
	type CodebuffAccountLease,
	type CodebuffAccountPool,
	type CodebuffClient,
	CodebuffError,
	CompletionAccumulator,
	debugLog,
	decodeSseData,
	deleteAndReleaseSession,
	encodeSse,
	errorMessage,
	errorResponse,
	isAbortError,
	isObject,
	isToolResultTurn,
	jsonResponse,
	modelsResponse,
	normalizeChatMessages,
	payloadRunId,
	resolveModel,
	responseNeedsToolFollowup,
	sanitizeStreamChunk,
	sessionId,
	stringOrNull,
	upstreamId,
} from "#freebuff";
import type { FreebuffModel, FreebuffRun, JsonObject, Settings } from "#types";

export function createHandler(
	settings: Settings,
	accounts: CodebuffAccountPool,
): (request: Request) => Promise<Response> {
	return async (request: Request) => {
		try {
			const url = new URL(request.url);
			if (request.method === "GET" && url.pathname === "/healthz") {
				checkLocalAuth(request, settings);
				return jsonResponse({ status: "ok" });
			}
			if (request.method === "GET" && url.pathname === "/v1/models") {
				checkLocalAuth(request, settings);
				return jsonResponse(modelsResponse());
			}
			if (
				request.method === "POST" &&
				url.pathname === "/v1/chat/completions"
			) {
				checkLocalAuth(request, settings);
				return await chatCompletions(request, settings, accounts);
			}
			return jsonResponse(
				{ error: { message: "Not found", type: "not_found" } },
				404,
			);
		} catch (error) {
			if (error instanceof Response) return error;
			if (error instanceof CodebuffError) return errorResponse(error);
			console.error(error);
			return jsonResponse(
				{
					error: {
						message: errorMessage(error),
						type: "server_error",
						code: "internal_error",
					},
				},
				500,
			);
		}
	};
}

async function chatCompletions(
	request: Request,
	settings: Settings,
	accounts: CodebuffAccountPool,
): Promise<Response> {
	let body: JsonObject;
	try {
		body = (await request.json()) as JsonObject;
	} catch {
		return jsonResponse(
			{
				error: { message: "Invalid JSON body", type: "invalid_request_error" },
			},
			400,
		);
	}

	let modelConfig: FreebuffModel;
	try {
		modelConfig = resolveModel(stringOrNull(body.model));
	} catch (error) {
		return jsonResponse(
			{
				error: { message: errorMessage(error), type: "invalid_request_error" },
			},
			400,
		);
	}

	const model = modelConfig.id;
	const messages = normalizeChatMessages(body.messages);
	console.info(
		`chat completion request model=${model} stream=${
			body.stream === true
		} messages=${messages.length}`,
	);
	debugLog(settings, "incoming chat body", body);

	let lease: CodebuffAccountLease | null = null;
	let run: FreebuffRun;
	let payload: JsonObject;
	try {
		lease = await accounts.acquireSession(sessionId(modelConfig), messages);
		const client = lease.client;
		await client.validateAgents();
		run = await lease.startOrReuseRun(modelConfig, isToolResultTurn(messages));
		payload = buildUpstreamPayload(
			{ ...body, messages },
			lease.session,
			payloadRunId(run),
			settings.clientId,
			crypto.randomUUID(),
			upstreamId(modelConfig),
		);
		debugLog(settings, "prepared upstream chat", payload);
	} catch (error) {
		if (lease) await deleteAndReleaseSession(lease);
		if (error instanceof CodebuffError) return errorResponse(error);
		throw error;
	}

	if (body.stream === true) {
		return new Response(
			streamOpenAIChunks(
				lease.client,
				payload,
				run,
				lease,
				request.signal,
			).pipeThrough(new TextEncoderStream()),
			{
				status: 200,
				headers: {
					"Content-Type": "text/event-stream; charset=utf-8",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
					"X-Accel-Buffering": "no",
				},
			},
		);
	}

	let deleteSessionAfterFinalize = false;
	try {
		const response = await collectCompletion(
			lease.client,
			payload,
			run,
			model,
			request.signal,
		);
		if (!responseNeedsToolFollowup(response)) {
			await lease.finishRun(run, stringOrNull(response.id));
		}
		return jsonResponse(response);
	} catch (error) {
		deleteSessionAfterFinalize = true;
		if (request.signal.aborted || isAbortError(error)) {
			console.info(`chat completion cancelled model=${model}`);
			return jsonResponse(
				{ error: { message: "Request cancelled", type: "cancelled" } },
				499,
			);
		}
		if (error instanceof CodebuffError) return errorResponse(error);
		throw error;
	} finally {
		if (deleteSessionAfterFinalize) await deleteAndReleaseSession(lease);
		else lease.finishNormally();
	}
}

function streamOpenAIChunks(
	client: CodebuffClient,
	payload: JsonObject,
	run: FreebuffRun,
	lease: CodebuffAccountLease,
	requestSignal: AbortSignal,
): ReadableStream<string> {
	const upstreamAbort = new AbortController();
	const abortFromRequest = () => upstreamAbort.abort(requestSignal.reason);
	if (requestSignal.aborted) abortFromRequest();
	else {
		requestSignal.addEventListener("abort", abortFromRequest, { once: true });
	}

	return new ReadableStream<string>({
		async start(controller) {
			let messageId: string | null = null;
			let shouldClose = true;
			let deleteSessionAfterFinalize = false;
			let needsToolFollowup = false;
			try {
				for await (const line of client.chatEvents(
					payload,
					upstreamAbort.signal,
				)) {
					const data = decodeSseData(line);
					if (data === null) continue;
					if (data === "[DONE]") {
						controller.enqueue(encodeSse("[DONE]"));
						break;
					}
					messageId = stringOrNull(data.id) ?? messageId;
					needsToolFollowup = needsToolFollowup || chunkNeedsToolFollowup(data);
					const chunk = sanitizeStreamChunk(data);
					if (chunk) controller.enqueue(encodeSse(chunk));
				}
			} catch (error) {
				if (upstreamAbort.signal.aborted || isAbortError(error)) {
					console.info(`chat stream cancelled run_id=${run.runId}`);
					shouldClose = false;
					deleteSessionAfterFinalize = true;
					return;
				}
				if (error instanceof CodebuffError) {
					deleteSessionAfterFinalize = true;
					console.warn(
						`chat stream failed run_id=${run.runId}: ${error.message}`,
					);
					controller.enqueue(
						encodeSse({
							error: {
								message: error.message,
								type: "upstream_error",
								code: "codebuff_error",
							},
						}),
					);
					controller.enqueue(encodeSse("[DONE]"));
				} else {
					shouldClose = false;
					deleteSessionAfterFinalize = true;
					controller.error(error);
					return;
				}
			} finally {
				requestSignal.removeEventListener("abort", abortFromRequest);
				if (deleteSessionAfterFinalize) {
					await lease.finishRun(run, messageId);
					await deleteAndReleaseSession(lease);
				} else {
					if (!needsToolFollowup) await lease.finishRun(run, messageId);
					lease.finishNormally();
				}
				if (shouldClose) controller.close();
			}
		},
		cancel() {
			upstreamAbort.abort();
		},
	});
}

async function collectCompletion(
	client: CodebuffClient,
	payload: JsonObject,
	run: FreebuffRun,
	model: string,
	signal: AbortSignal,
): Promise<JsonObject> {
	let messageId: string | null = null;
	const accumulator = new CompletionAccumulator(model);
	for await (const line of client.chatEvents(payload, signal)) {
		const data = decodeSseData(line);
		if (data === null) continue;
		if (data === "[DONE]") break;
		messageId = stringOrNull(data.id) ?? messageId;
		accumulator.add(data);
	}
	const response = accumulator.finalResponse();
	const choices = Array.isArray(response.choices)
		? (response.choices as JsonObject[])
		: [];
	const firstChoice = choices[0] ?? {};
	const message = isObject(firstChoice.message) ? firstChoice.message : {};
	console.info(
		`chat completion response run_id=${run.runId} message_id=${
			messageId ?? ""
		} content_chars=${String(message.content ?? "").length} finish_reason=${String(
			firstChoice.finish_reason ?? "",
		)}`,
	);
	return response;
}
