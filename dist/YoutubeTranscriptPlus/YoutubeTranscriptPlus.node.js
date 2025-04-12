"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeTranscriptPlus = void 0;
const n8n_workflow_1 = require("n8n-workflow");
// Attempt to import types. No official types found, so TS will use implicit 'any'.
// Removed the 'declare module' block to avoid TS2665 error.
const youtube_transcript_api_1 = require("youtube-transcript-api");
// Helper function revised: options only contains itemIndex. HTTP options are set internally.
async function makeApiRequest(method, url, body = {}, headers = {}, qs = {}, 
// This 'options' object is just for passing things like itemIndex within our node logic
internalOptions) {
    var _a, _b, _c;
    try {
        // Define HTTP request options directly here
        const requestOptions = {
            url,
            method,
            body,
            headers,
            qs,
            json: true,
            returnFullResponse: false, // Assume we only want the body by default
            // Add other necessary defaults or logic to set them
        };
        const responseData = await this.helpers.httpRequest(requestOptions);
        return responseData;
    }
    catch (error) {
        const errorMessage = error.message || (typeof error === 'string' ? error : 'Unknown API error');
        console.error(`API request failed: ${method} ${url}`, errorMessage, error);
        if (error.response) {
            console.error('API Response Status:', error.response.statusCode);
            console.error('API Response Body:', error.response.body);
        }
        const nodeOpErrorOptions = { itemIndex: internalOptions.itemIndex };
        if (error.statusCode === 429 || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.statusCode) === 429) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Rate limit exceeded for API request.', nodeOpErrorOptions);
        }
        if (error.statusCode === 401 || ((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.statusCode) === 401 ||
            error.statusCode === 403 || ((_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.statusCode) === 403) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Authentication failed for API request. Check credentials.', nodeOpErrorOptions);
        }
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `API request error: ${errorMessage}`, nodeOpErrorOptions);
    }
}
// --- Placeholder functions for core logic ---
async function getTranscriptLogic(videoId, itemIndex) {
    var _a;
    try {
        // youtube-transcript-api might be implicitly 'any' here due to lack of types
        const transcriptData = await youtube_transcript_api_1.YoutubeTranscript.fetchTranscript(videoId);
        if (!transcriptData || transcriptData.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `No transcript found for video ID: ${videoId}`, { itemIndex });
        }
        const fullTranscript = transcriptData.map((line) => line.text).join(' ');
        const language = ((_a = transcriptData[0]) === null || _a === void 0 ? void 0 : _a.lang) || 'unknown';
        return { text: fullTranscript, language };
    }
    catch (error) {
        if (error instanceof n8n_workflow_1.NodeOperationError)
            throw error;
        console.error(`Error fetching transcript for ${videoId}:`, error);
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to fetch transcript for video ${videoId}: ${error.message || error}`, { itemIndex });
    }
}
async function translateTextLogic(text, targetLanguage, translationApiUrl, sourceLanguage, itemIndex) {
    if (!text)
        return { translatedText: '' };
    if (!translationApiUrl) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Translation API URL is not configured in credentials.', { itemIndex });
    }
    const body = { q: text, source: sourceLanguage && sourceLanguage !== 'unknown' ? sourceLanguage.split('-')[0] : 'auto', target: targetLanguage, format: 'text', };
    try {
        // Pass itemIndex explicitly in the internalOptions object
        const result = await makeApiRequest.call(this, 'POST', translationApiUrl, body, { 'Content-Type': 'application/json' }, {}, { itemIndex });
        if (result && typeof result.translatedText === 'string') {
            return { translatedText: result.translatedText };
        }
        else {
            console.warn(`Translation API response missing 'translatedText' for item ${itemIndex}. Response:`, result);
            return { translatedText: text, warning: 'Unexpected translation API response format. Returning original text.' };
        }
    }
    catch (error) {
        console.error(`Translation failed for item ${itemIndex}:`, error);
        const warningMessage = `Translation failed: ${error.message || 'Unknown error'}. Returning original text.`;
        return { translatedText: text, warning: warningMessage };
    }
}
async function summarizeTextLogic(text, llmApiKey, llmApiUrl, llmModel, itemIndex) {
    var _a, _b, _c;
    if (!text)
        return { summary: '' };
    if (!llmApiKey || !llmApiUrl || !llmModel) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'LLM API Key, URL, or Model not configured in credentials. Summarization requires these.', { itemIndex });
    }
    const apiUrl = `${llmApiUrl.replace(/\/$/, '')}/chat/completions`;
    const headers = { 'Authorization': `Bearer ${llmApiKey}`, 'Content-Type': 'application/json', };
    const body = { model: llmModel, messages: [{ role: 'system', content: 'You are a helpful assistant. Summarize the following text concisely in Arabic.' }, { role: 'user', content: text },], };
    try {
        // Pass itemIndex explicitly in the internalOptions object
        const result = await makeApiRequest.call(this, 'POST', apiUrl, body, headers, {}, { itemIndex });
        if (((_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) && typeof result.choices[0].message.content === 'string') {
            return { summary: result.choices[0].message.content.trim() };
        }
        else {
            console.warn(`Summarization API response missing expected structure for item ${itemIndex}. Response:`, result);
            return { summary: null, warning: 'Unexpected summarization API response format.' };
        }
    }
    catch (error) {
        console.error(`Summarization failed for item ${itemIndex}:`, error);
        const warningMessage = `Summarization failed: ${error.message || 'Unknown error'}. Could not generate summary.`;
        return { summary: null, warning: warningMessage };
    }
}
async function getYoutubeData(endpoint, params, itemIndex, requiredKey) {
    var _a;
    if (!requiredKey) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'YouTube Data API Key is required for this operation but not configured in credentials.', { itemIndex });
    }
    const BASE_URL = 'https://www.googleapis.com/youtube/v3/';
    const url = `${BASE_URL}${endpoint}`;
    params.key = requiredKey;
    try {
        // Pass itemIndex explicitly in the internalOptions object
        const result = await makeApiRequest.call(this, 'GET', url, {}, {}, params, { itemIndex });
        if ((_a = result === null || result === void 0 ? void 0 : result.error) === null || _a === void 0 ? void 0 : _a.message) {
            throw new Error(`YouTube API Error: ${result.error.message} (Code: ${result.error.code || 'N/A'})`);
        }
        return result;
    }
    catch (error) {
        console.error(`YouTube Data API request failed for ${endpoint}:`, error);
        const errorMessage = (error === null || error === void 0 ? void 0 : error.message) || 'Unknown YouTube Data API error';
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `YouTube Data API request failed: ${errorMessage}`, { itemIndex });
    }
}
// --- URL Parsing Helper --- (remains the same)
function parseYoutubeIdentifier(identifier) {
    identifier = identifier.trim();
    let videoIdMatch = identifier.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (videoIdMatch && videoIdMatch[1]) {
        return { type: 'video', id: videoIdMatch[1] };
    }
    if (identifier.length === 11 && !identifier.includes('.') && !identifier.includes('/')) {
        return { type: 'video', id: identifier };
    }
    let playlistIdMatch = identifier.match(/[?&]list=([^"&?\/\s]+)/);
    if (playlistIdMatch && playlistIdMatch[1]) {
        return { type: 'playlist', id: playlistIdMatch[1] };
    }
    if (identifier.startsWith('PL') && identifier.length > 20 && !identifier.includes('/')) {
        return { type: 'playlist', id: identifier };
    }
    let channelIdMatch = identifier.match(/(?:youtube\.com\/(?:channel\/|c\/|user\/))([^"&?\/\s]+)/);
    if (channelIdMatch && channelIdMatch[1]) {
        if (channelIdMatch[1].startsWith('UC') && channelIdMatch[1].length === 24) {
            return { type: 'channel', id: channelIdMatch[1] };
        }
        return { type: 'channel', id: channelIdMatch[1] };
    }
    if (identifier.startsWith('UC') && identifier.length === 24 && !identifier.includes('/')) {
        return { type: 'channel', id: identifier };
    }
    return { type: 'unknown', id: null };
}
// --- Node Implementation ---
class YoutubeTranscriptPlus {
    constructor() {
        this.description = {
            displayName: 'YouTube Transcript Plus',
            name: 'youtubeTranscriptPlus',
            icon: 'file:youtubeTranscriptPlus.svg',
            group: ['transform', 'media'],
            version: 1,
            description: 'Fetches YouTube video transcripts, channel/playlist data, optionally translates to Arabic and summarizes transcripts.',
            defaults: { name: 'YouTube Transcript+', },
            // Explicitly type inputs/outputs
            inputs: ['main'],
            outputs: ['main'],
            credentials: [{ name: 'youtubeTranscriptPlusCredentialsApi', required: false, },],
            properties: [
                { /* Operation */ displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, options: [{ name: 'Get Transcript', value: 'getTranscript', action: 'Get video transcript' }, { name: 'Get Channel Info', value: 'getChannelInfo', action: 'Get youtube channel info' }, { name: 'List Channel Videos', value: 'listChannelVideos', action: 'List youtube channel videos' }, { name: 'List Playlist Videos', value: 'listPlaylistVideos', action: 'List youtube playlist videos' },], default: 'getTranscript', },
                { /* Identifier */ displayName: 'YouTube URL or ID', name: 'identifier', type: 'string', required: true, default: '', placeholder: 'e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ', description: 'The URL or ID of the Video, Channel, or Playlist depending on the operation', },
                { /* Options */ displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add Option', default: {}, options: [{ displayName: 'Translate to Arabic', name: 'translate', type: 'boolean', default: false, description: 'Whether to translate the fetched text (transcript, titles, descriptions) to Arabic using the configured Translation API' }, { displayName: 'Summarize Transcript', name: 'summarize', type: 'boolean', default: false, displayOptions: { show: { '/operation': ['getTranscript'] } }, description: 'Whether to summarize the fetched transcript (original or translated) using the configured LLM API. Requires LLM credentials.' }, { displayName: 'Max Results', name: 'maxResults', type: 'number', typeOptions: { minValue: 1, maxValue: 50 }, displayOptions: { show: { '/operation': ['listChannelVideos', 'listPlaylistVideos'] } }, default: 10, description: 'Maximum number of videos to retrieve for list operations (per page, pagination not implemented yet)' },], },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e;
        const items = this.getInputData();
        const returnData = [];
        let credentials;
        try {
            credentials = await this.getCredentials('youtubeTranscriptPlusCredentialsApi');
        }
        catch (error) { /* Handled later */ }
        const youtubeApiKey = credentials === null || credentials === void 0 ? void 0 : credentials.youtubeApiKey;
        const llmApiKey = credentials === null || credentials === void 0 ? void 0 : credentials.llmApiKey;
        const llmApiUrl = credentials === null || credentials === void 0 ? void 0 : credentials.llmApiUrl;
        const llmModel = credentials === null || credentials === void 0 ? void 0 : credentials.llmModel;
        const translationApiUrl = credentials === null || credentials === void 0 ? void 0 : credentials.translationApiUrl;
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            let resultData = {};
            let warnings = [];
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const identifier = this.getNodeParameter('identifier', itemIndex);
                const options = this.getNodeParameter('options', itemIndex, {});
                const targetLanguage = 'ar';
                resultData.originalIdentifier = identifier;
                switch (operation) {
                    case 'getTranscript':
                        const parsedVideo = parseYoutubeIdentifier(identifier);
                        if (parsedVideo.type !== 'video' || !parsedVideo.id)
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid YouTube Video URL or ID: ${identifier}`, { itemIndex });
                        resultData.videoId = parsedVideo.id;
                        const { text: originalTranscript, language: sourceLanguage } = await getTranscriptLogic.call(this, parsedVideo.id, itemIndex);
                        resultData.originalTranscript = originalTranscript;
                        resultData.sourceLanguage = sourceLanguage;
                        let transcriptToSummarize = originalTranscript;
                        if (options.translate && translationApiUrl) {
                            const translationResult = await translateTextLogic.call(this, originalTranscript, targetLanguage, translationApiUrl, sourceLanguage, itemIndex);
                            resultData.translatedTranscript = translationResult.translatedText;
                            if (translationResult.warning)
                                warnings.push(translationResult.warning);
                            if (translationResult.translatedText)
                                transcriptToSummarize = translationResult.translatedText;
                        }
                        if (options.summarize) {
                            if (!llmApiKey || !llmApiUrl || !llmModel)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Summarization requires LLM API Key, URL, and Model in credentials.', { itemIndex });
                            const summaryResult = await summarizeTextLogic.call(this, transcriptToSummarize, llmApiKey, llmApiUrl, llmModel, itemIndex);
                            resultData.summary = summaryResult.summary;
                            if (summaryResult.warning)
                                warnings.push(summaryResult.warning);
                        }
                        break;
                    case 'getChannelInfo':
                        const parsedChannel = parseYoutubeIdentifier(identifier);
                        if (parsedChannel.type !== 'channel' || !parsedChannel.id) {
                            if (parsedChannel.type === 'unknown' || !parsedChannel.id) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Could not reliably parse Channel ID/URL: ${identifier}.`, { itemIndex });
                            }
                        }
                        const channelIdInput = parsedChannel.id;
                        resultData.channelIdInput = channelIdInput;
                        if (!youtubeApiKey)
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'YouTube Data API Key required.', { itemIndex });
                        const params = { part: 'snippet,statistics,brandingSettings' };
                        if (channelIdInput.startsWith('UC') && channelIdInput.length === 24) {
                            params.id = channelIdInput;
                        }
                        else {
                            params.forUsername = channelIdInput;
                        }
                        const channelResponse = await getYoutubeData.call(this, 'channels', params, itemIndex, youtubeApiKey);
                        if (!((_a = channelResponse === null || channelResponse === void 0 ? void 0 : channelResponse.items) === null || _a === void 0 ? void 0 : _a[0]))
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Could not find channel info for: ${channelIdInput}`, { itemIndex });
                        resultData.channelInfo = channelResponse.items[0];
                        const channelInfoData = resultData.channelInfo;
                        if (options.translate && translationApiUrl && typeof (channelInfoData === null || channelInfoData === void 0 ? void 0 : channelInfoData.snippet) === 'object' && channelInfoData.snippet !== null) {
                            const snippet = channelInfoData.snippet;
                            const titleTranslation = await translateTextLogic.call(this, snippet.title || '', targetLanguage, translationApiUrl, snippet.defaultLanguage, itemIndex);
                            snippet.translatedTitle = titleTranslation.translatedText;
                            if (titleTranslation.warning)
                                warnings.push(`Title translation warning: ${titleTranslation.warning}`);
                            const descTranslation = await translateTextLogic.call(this, snippet.description || '', targetLanguage, translationApiUrl, snippet.defaultLanguage, itemIndex);
                            snippet.translatedDescription = descTranslation.translatedText;
                            if (descTranslation.warning)
                                warnings.push(`Description translation warning: ${descTranslation.warning}`);
                        }
                        break;
                    case 'listChannelVideos':
                        const parsedChanForVideoList = parseYoutubeIdentifier(identifier);
                        if (parsedChanForVideoList.type !== 'channel' || !parsedChanForVideoList.id) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid Channel URL/ID: ${identifier}`, { itemIndex });
                        }
                        const chanIdForVideoList = parsedChanForVideoList.id;
                        if (!youtubeApiKey)
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'YouTube Data API Key required.', { itemIndex });
                        const chanInfoParams = { part: 'contentDetails' };
                        if (chanIdForVideoList.startsWith('UC') && chanIdForVideoList.length === 24) {
                            chanInfoParams.id = chanIdForVideoList;
                        }
                        else {
                            chanInfoParams.forUsername = chanIdForVideoList;
                        }
                        const channelDetails = await getYoutubeData.call(this, 'channels', chanInfoParams, itemIndex, youtubeApiKey);
                        const uploadsPlaylistId = (_e = (_d = (_c = (_b = channelDetails === null || channelDetails === void 0 ? void 0 : channelDetails.items) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.contentDetails) === null || _d === void 0 ? void 0 : _d.relatedPlaylists) === null || _e === void 0 ? void 0 : _e.uploads;
                        if (!uploadsPlaylistId)
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Could not find uploads playlist ID for channel: ${chanIdForVideoList}`, { itemIndex });
                        const playlistItemsParams = { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: options.maxResults || 10 };
                        const playlistItemsResponse = await getYoutubeData.call(this, 'playlistItems', playlistItemsParams, itemIndex, youtubeApiKey);
                        resultData.videos = playlistItemsResponse.items || [];
                        if (options.translate && translationApiUrl && Array.isArray(resultData.videos)) {
                            for (const videoItem of resultData.videos) {
                                if (typeof videoItem.snippet === 'object' && videoItem.snippet !== null) {
                                    const snippet = videoItem.snippet;
                                    // Safely access contentDetails and videoId
                                    const contentDetails = videoItem.contentDetails;
                                    const videoId = (contentDetails && typeof contentDetails.videoId === 'string') ? contentDetails.videoId : 'N/A';
                                    const titleTranslation = await translateTextLogic.call(this, snippet.title || '', targetLanguage, translationApiUrl, undefined, itemIndex);
                                    snippet.translatedTitle = titleTranslation.translatedText;
                                    if (titleTranslation.warning)
                                        warnings.push(`Video ${videoId} title warning: ${titleTranslation.warning}`);
                                    const descTranslation = await translateTextLogic.call(this, snippet.description || '', targetLanguage, translationApiUrl, undefined, itemIndex);
                                    snippet.translatedDescription = descTranslation.translatedText;
                                    if (descTranslation.warning)
                                        warnings.push(`Video ${videoId} description warning: ${descTranslation.warning}`);
                                }
                            }
                        }
                        break;
                    case 'listPlaylistVideos':
                        const parsedPlaylist = parseYoutubeIdentifier(identifier);
                        if (parsedPlaylist.type !== 'playlist' || !parsedPlaylist.id) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid Playlist URL/ID: ${identifier}`, { itemIndex });
                        }
                        resultData.playlistId = parsedPlaylist.id;
                        if (!youtubeApiKey)
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'YouTube Data API Key required.', { itemIndex });
                        const plItemsParams = { part: 'snippet,contentDetails', playlistId: parsedPlaylist.id, maxResults: options.maxResults || 10 };
                        const plItemsResponse = await getYoutubeData.call(this, 'playlistItems', plItemsParams, itemIndex, youtubeApiKey);
                        resultData.videos = plItemsResponse.items || [];
                        if (options.translate && translationApiUrl && Array.isArray(resultData.videos)) {
                            for (const videoItem of resultData.videos) {
                                if (typeof videoItem.snippet === 'object' && videoItem.snippet !== null) {
                                    const snippet = videoItem.snippet;
                                    // Safely access contentDetails and videoId
                                    const contentDetails = videoItem.contentDetails;
                                    const videoId = (contentDetails && typeof contentDetails.videoId === 'string') ? contentDetails.videoId : 'N/A';
                                    const titleTranslation = await translateTextLogic.call(this, snippet.title || '', targetLanguage, translationApiUrl, undefined, itemIndex);
                                    snippet.translatedTitle = titleTranslation.translatedText;
                                    if (titleTranslation.warning)
                                        warnings.push(`Video ${videoId} title warning: ${titleTranslation.warning}`);
                                    const descTranslation = await translateTextLogic.call(this, snippet.description || '', targetLanguage, translationApiUrl, undefined, itemIndex);
                                    snippet.translatedDescription = descTranslation.translatedText;
                                    if (descTranslation.warning)
                                        warnings.push(`Video ${videoId} description warning: ${descTranslation.warning}`);
                                }
                            }
                        }
                        break;
                    default:
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
                }
                if (warnings.length > 0)
                    resultData.warnings = warnings;
                returnData.push({ json: resultData, pairedItem: { item: itemIndex } });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    let errorItemIndex = itemIndex;
                    // Safer check for error.description and itemIndex
                    if (error instanceof n8n_workflow_1.NodeOperationError && typeof error.description === 'object' && error.description !== null && typeof error.description.itemIndex === 'number') {
                        errorItemIndex = error.description.itemIndex;
                    }
                    const errorData = { error: error.message || 'Unknown error during execution.', itemIndex: errorItemIndex, details: error.stack, };
                    returnData.push({ json: errorData, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof Error) {
                    throw error;
                }
                else {
                    throw new Error(`Caught non-Error exception: ${error}`);
                }
            }
        }
        return this.prepareOutputData(returnData);
    }
}
exports.YoutubeTranscriptPlus = YoutubeTranscriptPlus;
