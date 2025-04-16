# n8n-nodes-youtube-transcript-plus

This is a custom n8n node package that allows you to interact with YouTube.

**Features:**

*   Fetch video transcripts using `youtube-transcript-api`.
*   Fetch channel details using YouTube Data API v3.
*   List videos in a channel or playlist using YouTube Data API v3.
*   Optionally translate fetched text (transcripts, titles, descriptions) into Arabic using a configurable translation API (e.g., LibreTranslate).
*   Optionally summarize video transcripts using a configurable LLM API (e.g., OpenRouter).

## Prerequisites

1.  **n8n:** Ensure you have a working n8n instance.
2.  **Node.js & npm:** Required for installation.
3.  **API Keys:**
    *   **YouTube Data API v3 Key:** **Required** for `Get Channel Info`, `List Channel Videos`, and `List Playlist Videos` operations. Obtain this from the [Google Cloud Console](https://console.cloud.google.com/).
    *   **LLM API Key:** **Required** if you enable the `Summarize Transcript` option. Get this from your chosen provider (e.g., [OpenRouter](https://openrouter.ai/)).
    *   **Translation API URL:** Configure the URL of a translation service (like a public or self-hosted [LibreTranslate](https://libretranslate.com/) instance) if using the `Translate to Arabic` option.

## Installation

1.  **Navigate to your custom nodes directory:**
    ```bash
    cd ~/.n8n/custom
    npm install -g typescript
    

    # Or for Docker installs, the equivalent mapped volume
    # cd /home/node/.n8n/custom
    ```
2.  **Clone or download this repository:**
    If you clone:
    ```bash
    git clone <repository_url> n8n-nodes-youtube-transcript-plus
    cd n8n-nodes-youtube-transcript-plus
    ```
    If you download and extract, `cd` into the extracted `n8n-nodes-youtube-transcript-plus` directory.
3.  **Install dependencies and build:**
    ```bash
    npm install
    npm run build
    ```
4.  **Restart n8n:**
    Make sure to restart your n8n instance completely to load the new node.

Alternatively, if you only have the built `dist` folder and `package.json`:

1.  Copy the entire `n8n-nodes-youtube-transcript-plus` folder (containing `dist`, `package.json`, etc.) into your `~/.n8n/custom` directory.
2.  Navigate into the copied folder:
    ```bash
    cd ~/.n8n/custom/n8n-nodes-youtube-transcript-plus
    ```
3.  Install dependencies:
    ```bash
    npm install --production
    # Installs only necessary runtime dependencies
    ```
4.  Restart n8n.
5.  else eample cp -r ~/Téléchargements/n8n-nodes-youtube-transcript-plus-main ~/.n8n/custom/n8n-nodes-youtube-transcript-plus


## Usage

1.  After installation and restarting n8n, find the "YouTube Transcript Plus" node in the node panel (likely under Transform or Media).
2.  Add the node to your workflow.
3.  **Configure Credentials:**
    *   Go to Credentials in n8n.
    *   Add new credentials of type "YouTube Transcript Plus Credentials API".
    *   Fill in your YouTube Data API Key (required for channel/playlist ops).
    *   Fill in your LLM API Key, URL, and Model (required for summarization).
    *   Verify/update the Translation API URL (required for translation).
    *   Save the credentials.
4.  **Configure Node Parameters:**
    *   Select the desired `Operation`.
    *   Enter the appropriate `YouTube URL or ID`.
    *   Enable `Translate to Arabic` and `Summarize Transcript` options as needed.
    *   Adjust `Max Results` for list operations if necessary.
5.  Connect the node and run your workflow.

## Development

1.  Clone the repository.
2.  Install all dependencies: `npm install`
3.  Build the code: `npm run build`
4.  Link the package for development:
    ```bash
    # In the node's directory:
    npm link

    # In your ~/.n8n/custom directory:
    npm link n8n-nodes-youtube-transcript-plus
    ```
5.  Run the development watcher: `npm run dev`
6.  Restart n8n after linking. Changes should now be reflected more quickly upon saving (though a restart might still be needed sometimes).

## License

MIT
