import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';
import { DEFAULTS, STYLES, copyablePrompt, loadSettings, readReply, requestBody, resolveStyle, validateEndpoint } from './core';
import type { Length, Settings, Style } from './core';

export default class ReplyStyleSwitcher extends Plugin {
  settings: Settings = { ...DEFAULTS };

  async onload() {
    this.settings = loadSettings(await this.loadData());
    const open = () => {
      const selection = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor.getSelection() ?? '';
      new ReplyModal(this.app, this, selection).open();
    };
    this.addCommand({ id: 'compose-reply', name: 'Compose a styled reply', callback: open });
    this.addRibbonIcon('messages-square', 'Compose a styled reply', open);
    this.addSettingTab(new ReplySettingsTab(this.app, this));
  }

  async saveSettings() { await this.saveData(this.settings); }
}

class ReplyModal extends Modal {
  private closed = false;
  private busy = false;

  constructor(app: App, private plugin: ReplyStyleSwitcher, private initialText: string) { super(app); }

  onOpen() {
    this.closed = false;
    const { contentEl } = this;
    contentEl.addClass('reply-style-switcher');
    contentEl.createEl('h2', { text: 'Compose a styled reply' });
    contentEl.createEl('p', { text: 'Write a message to reply to, or paste a draft to rewrite. Include any character context you want preserved.' });

    new Setting(contentEl).setName('Style').addDropdown(dropdown => {
      dropdown.addOptions({ ...STYLES, random: 'Random (avoid repeats)' }).setValue(this.plugin.settings.style);
      dropdown.onChange(async value => {
        this.plugin.settings.style = value as Style;
        await this.plugin.saveSettings();
      });
    });
    new Setting(contentEl).setName('Reply length').addDropdown(dropdown => {
      dropdown.addOptions({ short: 'Short', medium: 'Medium', long: 'Long' }).setValue(this.plugin.settings.length);
      dropdown.onChange(async value => {
        this.plugin.settings.length = value as Length;
        await this.plugin.saveSettings();
      });
    });

    const sourceLabel = contentEl.createEl('label', { text: 'Message or draft' });
    const source = sourceLabel.createEl('textarea', { cls: 'rss-textarea', attr: { rows: '7', placeholder: 'Paste your message, draft, or character context…' } });
    source.value = this.initialText;
    const status = contentEl.createEl('p', { cls: 'rss-status', attr: { role: 'status', 'aria-live': 'polite' } });
    const resultLabel = contentEl.createEl('label', { text: 'Preview' });
    const output = resultLabel.createEl('textarea', { cls: 'rss-textarea', attr: { rows: '8', readonly: 'true', placeholder: 'Your prompt or reply will appear here.' } });
    contentEl.createEl('p', { cls: 'rss-disclosure', text: 'Copy prompt works offline. Generate reply sends only the text above and style instructions to the endpoint you configure. Provider fees may apply.' });

    const actions = new Setting(contentEl);
    const chooseStyle = async () => {
      const style = resolveStyle(this.plugin.settings.style, this.plugin.settings.lastStyle);
      this.plugin.settings.lastStyle = style;
      await this.plugin.saveSettings();
      return style;
    };
    const report = (error: unknown) => {
      if (!this.closed) status.setText(error instanceof Error ? error.message : 'The operation failed. Please try again.');
    };
    const copy = async (text: string) => {
      if (!text.trim()) throw new Error('There is nothing to copy yet.');
      try { await navigator.clipboard.writeText(text); }
      catch { throw new Error('Clipboard unavailable. Select and copy the preview manually.'); }
      new Notice('Copied to clipboard.');
    };

    actions.addButton(button => button.setButtonText('Copy prompt').onClick(async () => {
      try {
        if (!source.value.trim()) throw new Error('Enter a message or draft first.');
        const style = await chooseStyle();
        output.value = copyablePrompt(source.value, style, this.plugin.settings.length);
        status.setText(`Prompt ready · ${STYLES[style]}`);
        await copy(output.value);
      } catch (error) { report(error); }
    }));
    actions.addButton(button => button.setButtonText('Generate reply').setCta().onClick(async () => {
      if (this.busy) return;
      this.busy = true;
      button.setDisabled(true);
      try {
        const config = { ...this.plugin.settings };
        const url = validateEndpoint(config.endpoint);
        if (!source.value.trim()) throw new Error('Enter a message or draft first.');
        const style = await chooseStyle();
        const body = requestBody(source.value, style, config);
        status.setText(`Generating · ${STYLES[style]}…`);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
        const response = await requestUrl({ url, method: 'POST', headers, body, throw: false });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`The server returned HTTP ${response.status}. Check the connection settings, credentials, and quota.`);
        }
        const reply = readReply(response.json);
        if (!this.closed) {
          output.value = reply;
          status.setText(`Reply ready · ${STYLES[style]}`);
        }
      } catch (error) {
        // Do not display request errors that might contain credentials or provider response bodies.
        report(error instanceof Error && /^(Enter |Set |Use |Keep |The server returned|The operation)/.test(error.message)
          ? error : new Error('The request failed. Check the endpoint, network connection, and model.'));
      } finally {
        this.busy = false;
        if (!this.closed) button.setDisabled(false);
      }
    }));
    new Setting(contentEl).addButton(button => button.setButtonText('Copy preview').onClick(async () => {
      try { await copy(output.value); } catch (error) { report(error); }
    }));
  }

  onClose() { this.closed = true; this.contentEl.empty(); }
}

class ReplySettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: ReplyStyleSwitcher) { super(app, plugin); }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'AI connection (optional)' });
    containerEl.createEl('p', { text: 'Prompt copying works without an account. Generation requires your own chat-completions-compatible service. Only text entered in the composer is sent, when you click Generate reply.' });
    new Setting(containerEl).setName('Endpoint URL').setDesc('Full HTTPS chat-completions URL. HTTP is allowed only for localhost.').addText(text => {
      text.setPlaceholder('https://your-provider.example/v1/chat/completions').setValue(this.plugin.settings.endpoint);
      text.onChange(async value => { this.plugin.settings.endpoint = value.trim(); await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName('Model').setDesc('Enter a model identifier supported by your provider.').addText(text => {
      text.setValue(this.plugin.settings.model);
      text.onChange(async value => { this.plugin.settings.model = value.trim(); await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName('API key').setDesc('Optional for local services. Stored in plain text in this plugin’s data.json inside your vault; exclude it from sync and shared vaults. Clear this field to remove it.').addText(text => {
      text.inputEl.type = 'password';
      text.inputEl.autocomplete = 'off';
      text.setValue(this.plugin.settings.apiKey);
      text.onChange(async value => { this.plugin.settings.apiKey = value.trim(); await this.plugin.saveSettings(); });
    });
  }
}
