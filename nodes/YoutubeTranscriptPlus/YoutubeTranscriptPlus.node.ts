import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
	NodeConnectionType, // Import this type for inputs/outputs
} from 'n8n-workflow';

// Attempt to import types. No official types found, so TS will use implicit 'any'.
// Removed the 'declare module' block to avoid TS2665 error.
import { YoutubeTranscript } from 'youtube-transcript-api';


// Helper function revised: options only contains itemIndex. HTTP options are set internally.
async function makeApiRequest(
	this: IExecuteFunctions,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	url: string,
	body: IDataObject = {},
	headers: Record<string, any> = {},
	qs: Record<string, any> = {},
	// This 'options' object is just for passing things like itemIndex within our node logic
	internalOptions: { itemIndex: number }
): Promise<any> {
	try {
		// Define HTTP request options directly here
		const requestOptions: IHttpRequestOptions = {
			url,
			method,
			body,
			headers,
			qs,
			json: true, // Assume JSON response by default
			returnFullResponse: false, // Assume we only want the body by default
			// Add other necessary defaults or logic to set them
		};

		const responseData = await this.helpers.httpRequest(requestOptions);
		return responseData;
	} catch (error: any) {
		const errorMessage = error.message || (typeof error === 'string' ? error : 'Unknown API error');
		console.error(`API request failed: ${method} ${url}`, errorMessage, error);
		if (error.response) {
			console.error('API Response Status:', error.response.statusCode);
			console.error('API Response Body:', error.response.body);
		}

		const nodeOpErrorOptions = { itemIndex: internalOptions.itemIndex };

		if (error.statusCode === 429 || error?.response?.statusCode === 429) {
			throw new NodeOperationError(this.getNode(), 'Rate limit exceeded for API request.', nodeOpErrorOptions);
		}
		if (error.statusCode === 401 || error?.response?.statusCode === 401 ||
			error.statusCode === 403 || error?.response?.statusCode === 403) {
			throw new NodeOperationError(this.getNode(), 'Authentication failed for API request. Check credentials.', nodeOpErrorOptions);
		}

		throw new NodeOperationError(this.getNode(), `API request error: ${errorMessage}`, nodeOpErrorOptions);
	}
}

// --- Placeholder functions for core logic ---

async function getTranscriptLogic(
	this: IExecuteFunctions,
	videoId: string,
	itemIndex: number,
): Promise<{ text: string; language: string }> {
	try {
		// youtube-transcript-api might be implicitly 'any' here due to lack of types
		const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
		if (!transcriptData || transcriptData.length === 0) {
			throw new NodeOperationError(this.getNode(), `No transcript found for video ID: ${videoId}`, { itemIndex });
		}
		const fullTranscript = transcriptData.map((line: { text: string }) => line.text).join(' ');
		const language = transcriptData[0]?.lang || 'unknown';
		return { text: fullTranscript, language };
	} catch (error: any) {
		if (error instanceof NodeOperationError) throw error;
		console.error(`Error fetching transcript for ${videoId}:`, error);
		throw new NodeOperationError(this.getNode(), `Failed to fetch transcript for video ${videoId}: ${error.message || error}`, { itemIndex });
	}
}

async function translateTextLogic(
	this: IExecuteFunctions,
	text: string,
	targetLanguage: string,
	translationApiUrl: string,
	sourceLanguage: string | undefined,
	itemIndex: number,
): Promise<{ translatedText: string | null; warning?: string }> {
	if (!text) return { translatedText: '' };
	if (!translationApiUrl) {
		throw new NodeOperationError(this.getNode(), 'Translation API URL is not configured in credentials.', { itemIndex });
	}

	const body: IDataObject = { q: text, source: sourceLanguage && sourceLanguage !== 'unknown' ? sourceLanguage.split('-')[0] : 'auto', target: targetLanguage, format: 'text', };

	try {
		// Pass itemIndex explicitly in the internalOptions object
		const result = await makeApiRequest.call(this, 'POST', translationApiUrl, body, { 'Content-Type': 'application/json' }, {}, { itemIndex });

		if (result && typeof result.translatedText === 'string') {
			return { translatedText: result.translatedText };
		} else {
			console.warn(`Translation API response missing 'translatedText' for item ${itemIndex}. Response:`, result);
			return { translatedText: text, warning: 'Unexpected translation API response format. Returning original text.' };
		}
	} catch (error: any) {
		console.error(`Translation failed for item ${itemIndex}:`, error);
		const warningMessage = `Translation failed: ${error.message || 'Unknown error'}. Returning original text.`;
		return { translatedText: text, warning: warningMessage };
	}
}

async function summarizeTextLogic(
	this: IExecuteFunctions,
	text: string,
	llmApiKey: string,
	llmApiUrl: string,
	llmModel: string,
	itemIndex: number,
): Promise<{ summary: string | null; warning?: string }> {
	if (!text) return { summary: '' };
	if (!llmApiKey || !llmApiUrl || !llmModel) {
		throw new NodeOperationError(this.getNode(), 'LLM API Key, URL, or Model not configured in credentials. Summarization requires these.', { itemIndex });
	}

	const apiUrl = `${llmApiUrl.replace(/\/$/, '')}/chat/completions`;
	const headers: Record<string, any> = { 'Authorization': `Bearer ${llmApiKey}`, 'Content-Type': 'application/json', };
	const body: IDataObject = { model: llmModel, messages: [ { role: 'system', content: 'You are a helpful assistant. Summarize the following text concisely in Arabic.' }, { role: 'user', content: text }, ], };

	try {
		// Pass itemIndex explicitly in the internalOptions object
		const result = await makeApiRequest.call(this, 'POST', apiUrl, body, headers, {}, { itemIndex });

		if (result?.choices?.[0]?.message?.content && typeof result.choices[0].message.content === 'string') {
			return { summary: result.choices[0].message.content.trim() };
		} else {
			console.warn(`Summarization API response missing expected structure for item ${itemIndex}. Response:`, result);
			return { summary: null, warning: 'Unexpected summarization API response format.' };
		}
	} catch (error: any) {
		console.error(`Summarization failed for item ${itemIndex}:`, error);
		const warningMessage = `Summarization failed: ${error.message || 'Unknown error'}. Could not generate summary.`;
		return { summary: null, warning: warningMessage };
	}
}

async function getYoutubeData(
	this: IExecuteFunctions,
	endpoint: string,
	params: Record<string, any>,
	itemIndex: number,
	requiredKey: string | undefined
): Promise<any> {
	if (!requiredKey) {
		throw new NodeOperationError(this.getNode(), 'YouTube Data API Key is required for this operation but not configured in credentials.', { itemIndex });
	}
	const BASE_URL = 'https://www.googleapis.com/youtube/v3/';
	const url = `${BASE_URL}${endpoint}`;
	params.key = requiredKey;

	try {
		// Pass itemIndex explicitly in the internalOptions object
		const result = await makeApiRequest.call(this, 'GET', url, {}, {}, params, { itemIndex });
		if (result?.error?.message) {
			throw new Error(`YouTube API Error: ${result.error.message} (Code: ${result.error.code || 'N/A'})`);
		}
		return result;
	} catch (error: any) {
		console.error(`YouTube Data API request failed for ${endpoint}:`, error);
		const errorMessage = error?.message || 'Unknown YouTube Data API error';
		throw new NodeOperationError(this.getNode(), `YouTube Data API request failed: ${errorMessage}`, { itemIndex });
	}
}

// --- URL Parsing Helper --- (remains the same)
function parseYoutubeIdentifier(identifier: string): { type: 'video' | 'channel' | 'playlist' | 'unknown', id: string | null } {
	identifier = identifier.trim();
	let videoIdMatch = identifier.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
	if (videoIdMatch && videoIdMatch[1]) { return { type: 'video', id: videoIdMatch[1] }; }
	if (identifier.length === 11 && !identifier.includes('.') && !identifier.includes('/')) { return { type: 'video', id: identifier }; }
	let playlistIdMatch = identifier.match(/[?&]list=([^"&?\/\s]+)/);
	if (playlistIdMatch && playlistIdMatch[1]) { return { type: 'playlist', id: playlistIdMatch[1] }; }
	if (identifier.startsWith('PL') && identifier.length > 20 && !identifier.includes('/')) { return { type: 'playlist', id: identifier }; }
	let channelIdMatch = identifier.match(/(?:youtube\.com\/(?:channel\/|c\/|user\/))([^"&?\/\s]+)/);
	if (channelIdMatch && channelIdMatch[1]) { if (channelIdMatch[1].startsWith('UC') && channelIdMatch[1].length === 24) { return { type: 'channel', id: channelIdMatch[1] }; } return { type: 'channel', id: channelIdMatch[1] }; }
	if (identifier.startsWith('UC') && identifier.length === 24 && !identifier.includes('/')) { return { type: 'channel', id: identifier }; }
	return { type: 'unknown', id: null };
}

// --- Node Implementation ---

export class YoutubeTranscriptPlus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YouTube Transcript Plus',
		name: 'youtubeTranscriptPlus',
		icon: 'file:youtubeTranscriptPlus.svg',
		group: ['transform', 'media'],
		version: 1,
		description: 'Fetches YouTube video transcripts, channel/playlist data, optionally translates to Arabic and summarizes transcripts.',
		defaults: { name: 'YouTube Transcript+', },
		// Explicitly type inputs/outputs
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		credentials: [ { name: 'youtubeTranscriptPlusCredentialsApi', required: false, }, ],
		properties: [
			{ /* Operation */ displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, options: [ { name: 'Get Transcript', value: 'getTranscript', action: 'Get video transcript' }, { name: 'Get Channel Info', value: 'getChannelInfo', action: 'Get youtube channel info' }, { name: 'List Channel Videos', value: 'listChannelVideos', action: 'List youtube channel videos' }, { name: 'List Playlist Videos', value: 'listPlaylistVideos', action: 'List youtube playlist videos' }, ], default: 'getTranscript', },
			{ /* Identifier */ displayName: 'YouTube URL or ID', name: 'identifier', type: 'string', required: true, default: '', placeholder: 'e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ', description: 'The URL or ID of the Video, Channel, or Playlist depending on the operation', },
			{ /* Options */ displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add Option', default: {}, options: [ { displayName: 'Translate to Arabic', name: 'translate', type: 'boolean', default: false, description: 'Whether to translate the fetched text (transcript, titles, descriptions) to Arabic using the configured Translation API' }, { displayName: 'Summarize Transcript', name: 'summarize', type: 'boolean', default: false, displayOptions: { show: { '/operation': ['getTranscript'] } }, description: 'Whether to summarize the fetched transcript (original or translated) using the configured LLM API. Requires LLM credentials.' }, { displayName: 'Max Results', name: 'maxResults', type: 'number', typeOptions: { minValue: 1, maxValue: 50 }, displayOptions: { show: { '/operation': ['listChannelVideos', 'listPlaylistVideos'] } }, default: 10, description: 'Maximum number of videos to retrieve for list operations (per page, pagination not implemented yet)' }, ], },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		let credentials;
		try { credentials = await this.getCredentials('youtubeTranscriptPlusCredentialsApi'); } catch (error) { /* Handled later */ }
		const youtubeApiKey = credentials?.youtubeApiKey as string | undefined;
		const llmApiKey = credentials?.llmApiKey as string | undefined;
		const llmApiUrl = credentials?.llmApiUrl as string | undefined;
		const llmModel = credentials?.llmModel as string | undefined;
		const translationApiUrl = credentials?.translationApiUrl as string | undefined;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			let resultData: JsonObject = {}; let warnings: string[] = [];
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const identifier = this.getNodeParameter('identifier', itemIndex) as string;
				const options = this.getNodeParameter('options', itemIndex, {}) as { translate?: boolean; summarize?: boolean; maxResults?: number; };
				const targetLanguage = 'ar'; resultData.originalIdentifier = identifier;

				switch (operation) {
					case 'getTranscript':
						const parsedVideo = parseYoutubeIdentifier(identifier);
						if (parsedVideo.type !== 'video' || !parsedVideo.id) throw new NodeOperationError(this.getNode(), `Invalid YouTube Video URL or ID: ${identifier}`, { itemIndex });
						resultData.videoId = parsedVideo.id;
						const { text: originalTranscript, language: sourceLanguage } = await getTranscriptLogic.call(this, parsedVideo.id, itemIndex);
						resultData.originalTranscript = originalTranscript; resultData.sourceLanguage = sourceLanguage;
						let transcriptToSummarize = originalTranscript;
						if (options.translate && translationApiUrl) {
							const translationResult = await translateTextLogic.call(this, originalTranscript, targetLanguage, translationApiUrl, sourceLanguage, itemIndex);
							resultData.translatedTranscript = translationResult.translatedText; if (translationResult.warning) warnings.push(translationResult.warning); if (translationResult.translatedText) transcriptToSummarize = translationResult.translatedText;
						}
						if (options.summarize) {
							if (!llmApiKey || !llmApiUrl || !llmModel) throw new NodeOperationError(this.getNode(), 'Summarization requires LLM API Key, URL, and Model in credentials.', { itemIndex });
							const summaryResult = await summarizeTextLogic.call(this, transcriptToSummarize, llmApiKey, llmApiUrl, llmModel, itemIndex);
							resultData.summary = summaryResult.summary; if (summaryResult.warning) warnings.push(summaryResult.warning);
						}
						break;
					case 'getChannelInfo':
						const parsedChannel = parseYoutubeIdentifier(identifier);
						if (parsedChannel.type !== 'channel' || !parsedChannel.id) { if (parsedChannel.type === 'unknown' || !parsedChannel.id) { throw new NodeOperationError(this.getNode(), `Could not reliably parse Channel ID/URL: ${identifier}.`, { itemIndex }); } }
						const channelIdInput = parsedChannel.id as string; resultData.channelIdInput = channelIdInput;
						if (!youtubeApiKey) throw new NodeOperationError(this.getNode(), 'YouTube Data API Key required.', { itemIndex });
						const params: Record<string, any> = { part: 'snippet,statistics,brandingSettings' }; if (channelIdInput.startsWith('UC') && channelIdInput.length === 24) { params.id = channelIdInput; } else { params.forUsername = channelIdInput; }
						const channelResponse = await getYoutubeData.call(this, 'channels', params, itemIndex, youtubeApiKey);
						if (!channelResponse?.items?.[0]) throw new NodeOperationError(this.getNode(), `Could not find channel info for: ${channelIdInput}`, { itemIndex });
						resultData.channelInfo = channelResponse.items[0] as JsonObject;
						const channelInfoData = resultData.channelInfo as IDataObject;
						if (options.translate && translationApiUrl && typeof channelInfoData?.snippet === 'object' && channelInfoData.snippet !== null) {
							const snippet = channelInfoData.snippet as IDataObject;
							const titleTranslation = await translateTextLogic.call(this, snippet.title as string || '', targetLanguage, translationApiUrl, snippet.defaultLanguage as string | undefined, itemIndex);
							snippet.translatedTitle = titleTranslation.translatedText; if (titleTranslation.warning) warnings.push(`Title translation warning: ${titleTranslation.warning}`);
							const descTranslation = await translateTextLogic.call(this, snippet.description as string || '', targetLanguage, translationApiUrl, snippet.defaultLanguage as string | undefined, itemIndex);
							snippet.translatedDescription = descTranslation.translatedText; if (descTranslation.warning) warnings.push(`Description translation warning: ${descTranslation.warning}`);
						}
						break;
					case 'listChannelVideos':
						const parsedChanForVideoList = parseYoutubeIdentifier(identifier);
						if (parsedChanForVideoList.type !== 'channel' || !parsedChanForVideoList.id) { throw new NodeOperationError(this.getNode(), `Invalid Channel URL/ID: ${identifier}`, { itemIndex }); }
						const chanIdForVideoList = parsedChanForVideoList.id as string;
						if (!youtubeApiKey) throw new NodeOperationError(this.getNode(), 'YouTube Data API Key required.', { itemIndex });
						const chanInfoParams: Record<string, any> = { part: 'contentDetails' }; if (chanIdForVideoList.startsWith('UC') && chanIdForVideoList.length === 24) { chanInfoParams.id = chanIdForVideoList; } else { chanInfoParams.forUsername = chanIdForVideoList; }
						const channelDetails = await getYoutubeData.call(this, 'channels', chanInfoParams, itemIndex, youtubeApiKey);
						const uploadsPlaylistId = channelDetails?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
						if (!uploadsPlaylistId) throw new NodeOperationError(this.getNode(), `Could not find uploads playlist ID for channel: ${chanIdForVideoList}`, { itemIndex });
						const playlistItemsParams = { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: options.maxResults || 10 };
						const playlistItemsResponse = await getYoutubeData.call(this, 'playlistItems', playlistItemsParams, itemIndex, youtubeApiKey);
						resultData.videos = playlistItemsResponse.items || [];
						if (options.translate && translationApiUrl && Array.isArray(resultData.videos)) {
							for (const videoItem of resultData.videos as IDataObject[]) {
								if (typeof videoItem.snippet === 'object' && videoItem.snippet !== null) {
									const snippet = videoItem.snippet as IDataObject;
									// Safely access contentDetails and videoId
									const contentDetails = videoItem.contentDetails as IDataObject | undefined;
									const videoId = (contentDetails && typeof contentDetails.videoId === 'string') ? contentDetails.videoId : 'N/A';
									const titleTranslation = await translateTextLogic.call(this, snippet.title as string || '', targetLanguage, translationApiUrl, undefined, itemIndex);
									snippet.translatedTitle = titleTranslation.translatedText; if (titleTranslation.warning) warnings.push(`Video ${videoId} title warning: ${titleTranslation.warning}`);
									const descTranslation = await translateTextLogic.call(this, snippet.description as string || '', targetLanguage, translationApiUrl, undefined, itemIndex);
									snippet.translatedDescription = descTranslation.translatedText; if (descTranslation.warning) warnings.push(`Video ${videoId} description warning: ${descTranslation.warning}`);
								}
							}
						}
						break;
					case 'listPlaylistVideos':
						const parsedPlaylist = parseYoutubeIdentifier(identifier);
						if (parsedPlaylist.type !== 'playlist' || !parsedPlaylist.id) { throw new NodeOperationError(this.getNode(), `Invalid Playlist URL/ID: ${identifier}`, { itemIndex }); }
						resultData.playlistId = parsedPlaylist.id as string;
						if (!youtubeApiKey) throw new NodeOperationError(this.getNode(), 'YouTube Data API Key required.', { itemIndex });
						const plItemsParams = { part: 'snippet,contentDetails', playlistId: parsedPlaylist.id, maxResults: options.maxResults || 10 };
						const plItemsResponse = await getYoutubeData.call(this, 'playlistItems', plItemsParams, itemIndex, youtubeApiKey);
						resultData.videos = plItemsResponse.items || [];
						if (options.translate && translationApiUrl && Array.isArray(resultData.videos)) {
							for (const videoItem of resultData.videos as IDataObject[]) {
								if (typeof videoItem.snippet === 'object' && videoItem.snippet !== null) {
									const snippet = videoItem.snippet as IDataObject;
									// Safely access contentDetails and videoId
									const contentDetails = videoItem.contentDetails as IDataObject | undefined;
									const videoId = (contentDetails && typeof contentDetails.videoId === 'string') ? contentDetails.videoId : 'N/A';
									const titleTranslation = await translateTextLogic.call(this, snippet.title as string || '', targetLanguage, translationApiUrl, undefined, itemIndex);
									snippet.translatedTitle = titleTranslation.translatedText; if (titleTranslation.warning) warnings.push(`Video ${videoId} title warning: ${titleTranslation.warning}`);
									const descTranslation = await translateTextLogic.call(this, snippet.description as string || '', targetLanguage, translationApiUrl, undefined, itemIndex);
									snippet.translatedDescription = descTranslation.translatedText; if (descTranslation.warning) warnings.push(`Video ${videoId} description warning: ${descTranslation.warning}`);
								}
							}
						}
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
				}
				if (warnings.length > 0) resultData.warnings = warnings;
				returnData.push({ json: resultData, pairedItem: { item: itemIndex } });
			} catch (error: any) {
				if (this.continueOnFail()) {
					let errorItemIndex = itemIndex;
					// Safer check for error.description and itemIndex
					if (error instanceof NodeOperationError && typeof error.description === 'object' && error.description !== null && typeof (error.description as any).itemIndex === 'number') {
                         errorItemIndex = (error.description as any).itemIndex;
                     }
					const errorData: JsonObject = { error: error.message || 'Unknown error during execution.', itemIndex: errorItemIndex, details: error.stack, };
					returnData.push({ json: errorData, pairedItem: { item: itemIndex } });
					continue;
				}
                if (error instanceof Error) { throw error; }
                else { throw new Error(`Caught non-Error exception: ${error}`); }
			}
		}
		return this.prepareOutputData(returnData);
	}
}
