# Reply Style Switcher

Compose reply prompts and generate replies in different styles inside Obsidian. This initial release is also being used to validate the plugin publishing workflow.

## Features

- Six styles: casual, gentle, humorous, cold and reserved, literary, and dramatic.
- Random mode avoids repeating the previous style.
- Short, medium, or long replies; style and length are saved per vault.
- Start from selected note text or type a message or draft into the composer.
- Copy a complete style prompt for use in another AI tool, with no network access.
- Optionally generate a reply through your own chat-completions-compatible service.
- Preview and copy the result; your notes are never automatically modified.

The prompts ask the model to preserve supplied character context and avoid writing the user's actions or dialogue. Generated results depend on the model and are not guaranteed to follow every instruction. Character memories are not collected or managed by this plugin: include relevant context in the input.

## Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/cecelia940809/reply-style-switcher/releases/latest).
2. Create `<vault>/.obsidian/plugins/reply-style-switcher/` and put all three files there.
3. Reload Obsidian, open **Settings → Community plugins**, and enable **Reply Style Switcher**.
4. Run **Reply Style Switcher: Compose a styled reply** from the command palette, or use the ribbon button.

Requires Obsidian 1.6.0 or later. The implementation uses cross-platform Obsidian and browser APIs; desktop and mobile runtime installation have not yet been manually tested.

## Usage

1. Optionally select a passage in a Markdown note.
2. Open the composer and choose a style and reply length.
3. Enter the message to reply to, or a draft to rewrite, including any necessary context.
4. Click **Copy prompt** to use the prompt in an AI tool. If clipboard access fails, manually copy the preview.
5. To generate in the composer, first configure an endpoint URL, model, and optional API key in the plugin settings. Then click **Generate reply**.
6. Change the style and generate again to rewrite the same input. Only the latest preview is retained. Click **Copy preview** to keep it.

The endpoint must be a full chat-completions URL (typically ending in `/v1/chat/completions`) and return text in `choices[0].message.content`. HTTPS is required except for local HTTP servers on `localhost`, `127.0.0.1`, or `::1`. The API key is optional for services that do not require authentication. Your provider may charge for requests.

## Privacy and storage

- No telemetry, background requests, or automatic reading of vault files.
- Opening the composer uses only the current selection, if any. The plugin does not send the note or surrounding vault content.
- **Copy prompt** and **Copy preview** write to the system clipboard only when clicked.
- **Generate reply** sends the composer input, style instructions, model identifier, and authentication header to the endpoint you configure. Review the endpoint and its privacy policy before use.
- Settings, including the API key, are stored in plain text in `<vault>/.obsidian/plugins/reply-style-switcher/data.json`. Do not commit, share, or sync that file. Clearing the key field removes the saved key.
- The plugin does not save generated replies to disk. Clipboard history and provider retention follow your system and provider settings.
- Closing the composer hides subsequent results but does not cancel an in-flight network request.

## Development

Use Node.js 22.18+ or 24+ (the tests use built-in TypeScript stripping).

```sh
npm ci
npm run types:check
npm test
npm run build
```

`main.js` is built from `src/main.ts` using esbuild with the Obsidian runtime externalized. The build has no bundled runtime dependencies beyond the plugin code. Tests cover style selection, prompt boundaries, outgoing request data, endpoint validation, settings normalization, and provider response parsing. Live provider generation requires your own service and credentials and is not covered by these tests.

## Publishing

This repository includes source code, an MIT license, a root manifest, and a version compatibility map. Release `1.0.0` has the same version as `manifest.json` and includes `main.js`, `manifest.json`, and `styles.css` as separate assets.

For later releases, update `package.json`, `package-lock.json`, `manifest.json`, and `versions.json`, run the checks above, then create a matching version tag and upload the three assets.

To test directory submission, paste the repository URL into the Obsidian Community submission form. Creating this repository and release does not submit it to the directory or guarantee acceptance. See the [official submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin).
