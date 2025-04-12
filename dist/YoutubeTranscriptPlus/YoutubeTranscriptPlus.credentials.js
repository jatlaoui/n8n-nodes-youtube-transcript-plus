"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Define the class WITHOUT the initial 'export'
class YoutubeTranscriptPlus {
    constructor() {
        this.name = 'youtubeTranscriptPlusCredentialsApi';
        this.displayName = 'YouTube Transcript Plus Credentials API';
        this.documentationUrl = ''; // Add relevant documentation links if available
        this.properties = [
            // ... keep all the properties exactly the same ...
            {
                displayName: 'YouTube Data API v3 Key',
                name: 'youtubeApiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                required: false,
                description: 'Required for Get Channel Info, List Channel Videos, List Playlist Videos operations. Get from Google Cloud Console.',
            },
            {
                displayName: 'LLM API Key (e.g., OpenRouter)',
                name: 'llmApiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                required: false,
                description: 'API Key for the Large Language Model provider (required for Summarization).',
            },
            {
                displayName: 'LLM API Base URL',
                name: 'llmApiUrl',
                type: 'string',
                default: 'https://openrouter.ai/api/v1',
                description: 'The base URL for the LLM API endpoint (e.g., for chat completions).',
            },
            {
                displayName: 'LLM Model Name',
                name: 'llmModel',
                type: 'string',
                default: 'openai/gpt-3.5-turbo',
                description: 'The specific model identifier to use for summarization (e.g., openai/gpt-3.5-turbo, mistralai/mistral-7b-instruct).',
            },
            {
                displayName: 'Translation API URL',
                name: 'translationApiUrl',
                type: 'string',
                default: 'https://libretranslate.de/translate',
                description: 'URL of the translation API endpoint (e.g., LibreTranslate). Must accept POST with {q, source, target, format}. Target will be \'ar\'.',
            },
        ];
    }
}
// Add this line at the very end to explicitly export
module.exports = { YoutubeTranscriptPlus };
