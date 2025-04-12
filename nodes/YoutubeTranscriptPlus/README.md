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
2.  **Node.js & npm:** Required for installation (Node.js v18+ recommended).
3.  **API Keys:**
    *   **YouTube Data API v3 Key:** **Required** for `Get Channel Info`, `List Channel Videos`, and `List Playlist Videos` operations. Obtain this from the [Google Cloud Console](https://console.cloud.google.com/).
    *   **LLM API Key:** **Required** if you enable the `Summarize Transcript` option. Get this from your chosen provider (e.g., [OpenRouter](https://openrouter.ai/)).
    *   **Translation API URL:** Configure the URL of a translation service (like a public or self-hosted [LibreTranslate](https://libretranslate.com/) instance) if using the `Translate to Arabic` option.

## Installation

1.  **Navigate to your node project directory:**
    Open your terminal and navigate to the directory where you saved this `n8n-nodes-youtube-transcript-plus` code.
    ```bash
    cd /path/to/your/n8n-nodes-youtube-transcript-plus
    ```
2.  **Install dependencies and build:**
    ```bash
    npm install
    npm run build
    ```
    Ensure this completes without errors (ignore 404 errors for `@types/youtube-transcript-api` if they appear during `npm install`). The `build` command should succeed.
3.  **Navigate to your n8n custom nodes directory:**
    This is usually `~/.n8n/custom`. If it doesn't exist, create it.
    ```bash
    cd ~/.n8n/custom
    # Or for Docker installs, the equivalent mapped volume host path
    # cd /path/on/host/mapped/to/.n8n/custom
    ```
4.  **Install the node package using its absolute path:**
    Use the path to the directory from Step 1.
    ```bash
    npm install /path/to/your/n8n-nodes-youtube-transcript-plus
    ```
5.  **Restart n8n:**
    Make sure to restart your n8n instance completely (e.g., `n8n start`, `pm2 restart n8n`, `docker restart <container_name>`) to load the new node.

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

1.  Navigate to the node's source directory (Step 1 of Installation).
2.  Run `npm run dev` to watch for changes and rebuild automatically (requires stopping the main build process if running).
3.  You may still need to restart n8n to see some changes reflected. Linking (`npm link`) can also be used for faster development cycles.

## License

MIT
