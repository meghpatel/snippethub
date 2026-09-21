'use strict';
const vscode = require('vscode');
const { SearchEngine } = require('./core/search');
const catalog = require('./catalog/python.json');

function activate(context) {
  const engine = new SearchEngine(catalog);
  context.subscriptions.push(vscode.commands.registerCommand('snippethub.search', () => {
    // Capture the target before the picker takes focus. Never insert into a later editor.
    const editor = vscode.window.activeTextEditor;
    const selections = editor ? [...editor.selections] : [];
    const version = editor?.document.version;
    const picker = vscode.window.createQuickPick();
    picker.title = 'SnippetHub · Python';
    picker.placeholder = 'Try “import a JSON” or “remove duplicates from a list”';
    picker.matchOnDescription = false;
    picker.matchOnDetail = false;
    picker.sortByLabel = false;
    picker.ignoreFocusOut = false;
    const previewButton = { iconPath: new vscode.ThemeIcon('open-preview'), tooltip: 'Preview code' };
    const copyButton = { iconPath: new vscode.ThemeIcon('copy'), tooltip: 'Copy code' };
    const update = query => {
      picker.items = engine.search(query).map(({ snippet }) => ({
        label: snippet.title,
        description: snippet.dependencies.length ? `Requires ${snippet.dependencies.join(', ')}` : 'Python standard library',
        detail: snippet.description,
        // Bypass QuickPick's own fuzzy filter; ordering and matching belong to our engine.
        alwaysShow: true,
        buttons: [previewButton, copyButton],
        snippet,
      }));
      picker.activeItems = picker.items.slice(0, 1);
      picker.title = `SnippetHub · Python · ${picker.items.length} results · Enter to insert`;
    };
    const handlers = [];
    let accepting = false;
    handlers.push(picker.onDidChangeValue(update));
    handlers.push(picker.onDidTriggerItemButton(async ({ item, button }) => {
      try {
        if (button === copyButton) {
          await vscode.env.clipboard.writeText(item.snippet.code);
          vscode.window.setStatusBarMessage(`Copied: ${item.snippet.title}`, 2000);
        } else {
          const doc = await vscode.workspace.openTextDocument({ language: 'python', content: item.snippet.code });
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true });
        }
      } catch (error) { vscode.window.showErrorMessage(`SnippetHub: ${error.message}`); }
    }));
    handlers.push(picker.onDidAccept(async () => {
      const item = picker.selectedItems[0];
      if (!item || accepting) return;
      accepting = true;
      picker.hide();
      try {
        if (!editor) {
          const doc = await vscode.workspace.openTextDocument({ language: 'python', content: item.snippet.code });
          await vscode.window.showTextDocument(doc);
          return;
        }
        if (editor.document.isClosed || editor.document.version !== version) {
          vscode.window.showWarningMessage('SnippetHub: the target document changed. Reopen search to insert at the current cursor.');
          return;
        }
        const content = new vscode.SnippetString();
        content.appendText(item.snippet.code); // Treat $, braces, and backslashes as literal Python.
        const inserted = await editor.insertSnippet(content, selections);
        if (!inserted) vscode.window.showWarningMessage('SnippetHub could not insert into this document. Try copying the snippet instead.');
      } catch (error) { vscode.window.showErrorMessage(`SnippetHub: ${error.message}`); }
    }));
    handlers.push(picker.onDidHide(() => {
      handlers.forEach(handler => handler.dispose());
      picker.dispose();
    }));
    update('');
    picker.show();
  }));
}

module.exports = { activate };
