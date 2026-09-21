const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const catalog = require('../catalog/python.json');

function setup(editor) {
  const handlers = {};
  const calls = { inserted: [], opened: [], copied: [], warnings: [] };
  const disposable = () => ({ dispose() {} });
  const picker = { selectedItems: [],
    onDidChangeValue: fn => { handlers.change = fn; return disposable(); },
    onDidAccept: fn => { handlers.accept = fn; return disposable(); },
    onDidTriggerItemButton: fn => { handlers.button = fn; return disposable(); },
    onDidHide: fn => { handlers.hide = fn; return disposable(); },
    hide() { handlers.hide(); }, dispose() { calls.disposed = true; }, show() {},
  };
  if (editor) editor.insertSnippet = async (snippet, selections) => { calls.inserted.push({ text: snippet.value, selections }); return true; };
  const api = {
    commands: { registerCommand: (_name, fn) => { handlers.command = fn; return disposable(); } },
    window: { activeTextEditor: editor, createQuickPick: () => picker,
      showTextDocument: async () => {}, setStatusBarMessage() {},
      showWarningMessage: msg => calls.warnings.push(msg), showErrorMessage: msg => { throw Error(msg); } },
    workspace: { openTextDocument: async doc => { calls.opened.push(doc); return doc; } },
    env: { clipboard: { writeText: async text => calls.copied.push(text) } },
    ThemeIcon: class { constructor(id) { this.id = id; } },
    SnippetString: class { value = ''; appendText(text) { this.value += text; } },
    ViewColumn: { Beside: 2 },
  };
  const sandbox = { module: { exports: {} }, require: name => name === 'vscode' ? api :
    name === './core/search' ? require('../core/search') : catalog };
  vm.runInNewContext(fs.readFileSync(require.resolve('../apps/vscode/extension'), 'utf8'), sandbox);
  sandbox.module.exports.activate({ subscriptions: [] });
  handlers.command();
  return { handlers, calls, picker, api };
}

test('natural-language picker inserts literal code into original multi-cursor selections', async () => {
  const selections = [{ start: 1 }, { start: 4 }];
  const original = { document: { version: 1, isClosed: false }, selections };
  const { handlers, calls, picker, api } = setup(original);
  handlers.change('import a JSON');
  assert.equal(picker.items[0].snippet.id, 'read-json-file');
  assert.equal(picker.items[0].alwaysShow, true);
  assert.equal(picker.sortByLabel, false);
  assert.equal(picker.activeItems[0], picker.items[0]);
  picker.selectedItems = [picker.items[0]];
  api.window.activeTextEditor = { document: {} };
  await handlers.accept();
  assert.equal(calls.inserted[0].text, catalog[0].code);
  assert.deepEqual(Array.from(calls.inserted[0].selections), selections);
  assert.equal(calls.disposed, true);
});
test('no active editor opens a Python scratch document', async () => {
  const { handlers, calls, picker } = setup();
  picker.selectedItems = [picker.items[0]];
  await handlers.accept();
  assert.equal(calls.opened[0].language, 'python');
  assert.equal(calls.opened[0].content, catalog[0].code);
});
test('changed target document is not overwritten', async () => {
  const editor = { document: { version: 1 }, selections: [{}] };
  const { handlers, calls, picker } = setup(editor);
  picker.selectedItems = [picker.items[0]];
  editor.document.version = 2;
  await handlers.accept();
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.warnings.length, 1);
});
test('copy and preview buttons expose selected code without insertion', async () => {
  const { handlers, calls, picker } = setup();
  const item = picker.items[0];
  await handlers.button({ item, button: item.buttons[1] });
  await handlers.button({ item, button: item.buttons[0] });
  assert.equal(calls.copied[0], catalog[0].code);
  assert.equal(calls.opened[0].content, catalog[0].code);
  assert.equal(calls.inserted.length, 0);
});
test('no results cannot insert and acceptance is single-shot', async () => {
  const { handlers, calls, picker } = setup();
  handlers.change('kubernetes');
  assert.equal(picker.items.length, 0);
  await handlers.accept();
  assert.equal(calls.opened.length, 0);
  handlers.change('json');
  picker.selectedItems = [picker.items[0]];
  await Promise.all([handlers.accept(), handlers.accept()]);
  assert.equal(calls.opened.length, 1);
});
