import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

// Define the class WITHOUT the initial 'export'
class YoutubeTranscriptPlus implements ICredentialType {
	name = 'youtubeTranscriptPlusCredentialsApi';
	displayName = 'YouTube Transcript Plus Credentials API';
	documentationUrl = ''; // Add relevant documentation links if available
	properties: INodeProperties[] = [
		// ... keep all the properties exactly the same ...
    {
        displayName: 'YouTube Data API v3 Key',
        name: 'youtubeApiKey',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: false, // Required only for channel/playlist operations, checked in node
        description: 'Required for Get Channel Info, List Channel Videos, List Playlist Videos operations. Get from Google Cloud Console.',
    },
    {
        displayName: 'LLM API Key (e.g., OpenRouter)',
        name: 'llmApiKey',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: false, // Required only if summarization is enabled
        description: 'API Key for the Large Language Model provider (required for Summarization).',
    },
    {
        displayName: 'LLM API Base URL',
        name: 'llmApiUrl',
        type: 'string',
        default: 'https://openrouter.ai/api/v1', // Default for OpenRouter
        description: 'The base URL for the LLM API endpoint (e.g., for chat completions).',
    },
    {
        displayName: 'LLM Model Name',
        name: 'llmModel',
        type: 'string',
        default: 'openai/gpt-3.5-turbo', // Example model, user should verify on their provider
        description: 'The specific model identifier to use for summarization (e.g., openai/gpt-3.5-turbo, mistralai/mistral-7b-instruct).',
    },
    {
        displayName: 'Translation API URL',
        name: 'translationApiUrl',
        type: 'string',
        default: 'https://libretranslate.de/translate', // Example public LibreTranslate instance
        description: 'URL of the translation API endpoint (e.g., LibreTranslate). Must accept POST with {q, source, target, format}. Target will be \'ar\'.',
    },
	];
}

// Add this line at the very end to explicitly export
module.exports = { YoutubeTranscriptPlus };
