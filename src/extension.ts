import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CommentStore, Comment } from './commentStore';
import { CommentTreeProvider } from './commentView';

// ─────────────────────────────────────────────────────────────────────────────
// Decoration types
//   highlightDecoration  — yellow background on the original commented text
//   hideDecoration       — collapses \todo{...} to a tiny 💬 icon in editor
// ─────────────────────────────────────────────────────────────────────────────
let highlightDecoration: vscode.TextEditorDecorationType;
let hideDecoration: vscode.TextEditorDecorationType;

function buildDecorations(): void {
  highlightDecoration?.dispose();
  hideDecoration?.dispose();

  const color = vscode.workspace
    .getConfiguration('latexCommenter')
    .get<string>('highlightColor', 'rgba(255, 220, 0, 0.35)');

  highlightDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: color,
    border: '1px solid rgba(200,160,0,0.5)',
    borderRadius: '2px',
  });

  // The \todo{...} tag is made effectively invisible by:
  //   - color: transparent  → no visible characters
  //   - textDecoration hack → font-size:1px collapses each char to ~0 width
  //   - before: contentText → shows a subtle 💬 icon in its place
  hideDecoration = vscode.window.createTextEditorDecorationType({
    color: 'transparent',
    textDecoration: 'none; font-size: 1px; letter-spacing: -1px;',
    before: {
      contentText: '💬',
      color: 'rgba(120,120,120,0.55)',
      margin: '0 1px 0 1px',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply both decorations for the active editor
// ─────────────────────────────────────────────────────────────────────────────
function applyDecorations(editor: vscode.TextEditor, store: CommentStore): void {
  const comments = store.getForFile(editor.document.uri.fsPath);
  const docText = editor.document.getText();

  const highlights: vscode.DecorationOptions[] = [];
  const hides: vscode.DecorationOptions[] = [];

  for (const c of comments) {
    // Yellow highlight on the original selected text
    const start = new vscode.Position(c.range.startLine, c.range.startChar);
    const end   = new vscode.Position(c.range.endLine,   c.range.endChar);
    const hoverMd = buildHoverMarkdown(c);
    highlights.push({
      range: new vscode.Range(start, end),
      hoverMessage: hoverMd,
    });

    // Find the \todo{...} tag in the document and collapse it
    const idx = docText.indexOf(c.todoText);
    if (idx !== -1) {
      const tStart = editor.document.positionAt(idx);
      const tEnd   = editor.document.positionAt(idx + c.todoText.length);
      hides.push({ range: new vscode.Range(tStart, tEnd), hoverMessage: hoverMd });
    }
  }

  editor.setDecorations(highlightDecoration, highlights);
  editor.setDecorations(hideDecoration, hides);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ensure \usepackage{todonotes} is in preamble
// ─────────────────────────────────────────────────────────────────────────────
async function ensureTodonotesPackage(editor: vscode.TextEditor): Promise<number> {
  const text = editor.document.getText();
  if (text.includes('todonotes')) { return -1; }
  const beginDoc = text.indexOf('\\begin{document}');
  if (beginDoc === -1) { return -1; }
  const pos = editor.document.positionAt(beginDoc);
  await editor.edit(eb => {
    eb.insert(pos, '\\usepackage[colorinlistoftodos]{todonotes}\n');
  });
  return pos.line; // caller uses this to shift comment ranges below this line
}

// ─────────────────────────────────────────────────────────────────────────────
// CodeLens: shows "💬 Add Comment" above a non-empty selection
// ─────────────────────────────────────────────────────────────────────────────
class CommentCodeLensProvider implements vscode.CodeLensProvider {
  private _onChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onChange.event;
  private sel: vscode.Selection | null = null;

  updateSelection(sel: vscode.Selection | null): void {
    this.sel = sel;
    this._onChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!this.sel || this.sel.isEmpty) { return []; }
    const cfg = vscode.workspace.getConfiguration('latexCommenter');
    if (!cfg.get<boolean>('showCodeLens', true)) { return []; }
    return [
      new vscode.CodeLens(
        new vscode.Range(this.sel.start, this.sel.start),
        { title: '💬 Add Comment', command: 'latexCommenter.addComment' }
      ),
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function buildHoverMarkdown(c: Comment): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**💬 ${c.author}** · *${c.timestamp}*\n\n`);
  md.appendMarkdown(`> ${c.selectedText.replace(/\n/g, '\n> ')}\n\n`);
  md.appendMarkdown(`---\n\n${c.commentText}`);
  return md;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension entry point
// ─────────────────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
  buildDecorations();

  const store = new CommentStore(context);
  const treeProvider = new CommentTreeProvider(store);
  const codeLensProvider = new CommentCodeLensProvider();

  vscode.window.registerTreeDataProvider('latexCommenterComments', treeProvider);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'latex', scheme: 'file' },
      codeLensProvider
    )
  );

  const isLatex = (ed: vscode.TextEditor) =>
    ed.document.languageId === 'latex' || ed.document.languageId === 'tex';

  // Keep context key in sync so the sidebar panel stays visible when comments exist
  const refreshContextKey = () => {
    vscode.commands.executeCommand(
      'setContext', 'latexCommenter.hasComments', store.getAll().length > 0
    );
  };
  refreshContextKey();

  // Refresh decorations on editor / store change
  const refreshActive = () => {
    const ed = vscode.window.activeTextEditor;
    if (ed && isLatex(ed)) { applyDecorations(ed, store); }
    refreshContextKey();
  };

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(ed => {
    if (ed && isLatex(ed)) { applyDecorations(ed, store); }
    refreshContextKey();
  }));
  context.subscriptions.push(store.onChange(refreshActive));

  // Track selection for CodeLens
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(e => {
      if (!isLatex(e.textEditor)) { return; }
      const sel = e.selections[0];
      codeLensProvider.updateSelection(sel.isEmpty ? null : sel);
    })
  );

  // Rebuild decorations if color setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('latexCommenter.highlightColor')) {
        buildDecorations();
        refreshActive();
      }
    })
  );

  // Apply on startup
  vscode.window.visibleTextEditors.forEach(ed => {
    if (isLatex(ed)) { applyDecorations(ed, store); }
  });

  // ── HOVER PROVIDER ─────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [{ language: 'latex', scheme: 'file' }, { language: 'tex', scheme: 'file' }],
      {
        provideHover(document, position) {
          const comments = store.getForFile(document.uri.fsPath);
          const docText = document.getText();
          for (const c of comments) {
            const selStart = new vscode.Position(c.range.startLine, c.range.startChar);
            const selEnd   = new vscode.Position(c.range.endLine,   c.range.endChar);
            const selRange = new vscode.Range(selStart, selEnd);
            let matched = selRange.contains(position);
            if (!matched) {
              const idx = docText.indexOf(c.todoText);
              if (idx !== -1) {
                const tStart = document.positionAt(idx);
                const tEnd   = document.positionAt(idx + c.todoText.length);
                matched = new vscode.Range(tStart, tEnd).contains(position);
              }
            }
            if (matched) {
              return new vscode.Hover(buildHoverMarkdown(c), selRange);
            }
          }
          return undefined;
        },
      }
    )
  );

  // ── ADD COMMENT ────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('latexCommenter.addComment', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'latex') {
        vscode.window.showWarningMessage('Open a .tex file and select some text first.');
        return;
      }
      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Select some text before adding a comment.');
        return;
      }

      const selectedText = editor.document.getText(selection);

      const cfg = vscode.workspace.getConfiguration('latexCommenter');
      let author = cfg.get<string>('authorName', '').trim();
      if (!author) {
        author = await vscode.window.showInputBox({
          prompt: 'Your name (saved in settings)',
          placeHolder: 'e.g. Alice',
        }) ?? '';
        if (!author) { return; }
        await cfg.update('authorName', author, vscode.ConfigurationTarget.Global);
      }

      const commentText = await vscode.window.showInputBox({
        prompt: `Comment on: "${selectedText.slice(0, 60)}${selectedText.length > 60 ? '…' : ''}"`,
        placeHolder: 'Type your comment here…',
        ignoreFocusOut: true,
      });
      if (commentText === undefined || commentText.trim() === '') { return; }

      // \todo produces a margin note in the PDF; hidden in editor via decoration
      const todoText = `\\todo[color=yellow!40]{${author}: ${commentText.trim()}}`;

      const comment: Comment = {
        id: uid(),
        filePath: editor.document.uri.fsPath,
        selectedText,
        commentText: commentText.trim(),
        author,
        timestamp: new Date().toLocaleString(),
        todoText,
        range: {
          startLine: selection.start.line,
          startChar: selection.start.character,
          endLine: selection.end.line,
          endChar: selection.end.character,
        },
      };

      // Insert \todo right after the selection (on same line, no visible break)
      await editor.edit(eb => { eb.insert(selection.end, todoText); });

      // Auto-add todonotes package if needed; returns the insertion line if a
      // new line was prepended, which shifts all body lines down by 1.
      const insertedAtLine = await ensureTodonotesPackage(editor);
      if (insertedAtLine !== -1 && comment.range.startLine >= insertedAtLine) {
        comment.range.startLine += 1;
        comment.range.endLine   += 1;
      }

      store.add(comment);
      codeLensProvider.updateSelection(null);
      vscode.window.setStatusBarMessage('💬 Comment added', 3000);
    })
  );

  // ── DELETE COMMENT ─────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('latexCommenter.deleteComment', async (item: any) => {
      if (!item?.comment?.id) { return; }
      const comment: Comment = item.comment;

      try {
        const doc = await vscode.workspace.openTextDocument(comment.filePath);
        const text = doc.getText();
        const idx = text.indexOf(comment.todoText);
        if (idx !== -1) {
          const ed = await vscode.window.showTextDocument(doc, { preserveFocus: true });
          const start = doc.positionAt(idx);
          const end   = doc.positionAt(idx + comment.todoText.length);
          await ed.edit(eb => { eb.delete(new vscode.Range(start, end)); });
        }
      } catch { /* file moved/deleted — remove record anyway */ }

      store.delete(comment.id);
    })
  );

  // ── CLEAR ALL ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('latexCommenter.clearAll', async () => {
      const answer = await vscode.window.showWarningMessage(
        'Delete ALL comments across all files?',
        { modal: true },
        'Yes, delete all'
      );
      if (answer === 'Yes, delete all') { store.clearAll(); }
    })
  );

  // ── EXPORT COMMENTS ────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('latexCommenter.exportComments', async () => {
      const editor = vscode.window.activeTextEditor;
      const filePath = editor?.document.uri.fsPath;
      const text = filePath
        ? store.exportAsText(filePath)
        : store.getAll().map(c =>
            `[${vscode.workspace.asRelativePath(c.filePath)}] ${c.author} — ${c.timestamp}\n` +
            `  Quoted: "${c.selectedText}"\n` +
            `  Line ${c.range.startLine + 1}: ${c.commentText}`
          ).join('\n\n');

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          path.join(
            filePath ? path.dirname(filePath) : (vscode.workspace.rootPath ?? ''),
            'comments-export.txt'
          )
        ),
        filters: { 'Text file': ['txt'] },
      });
      if (uri) {
        fs.writeFileSync(uri.fsPath, text, 'utf-8');
        vscode.window.showInformationMessage(`Comments exported to ${uri.fsPath}`);
      }
    })
  );

  // ── PICK AND DELETE (command palette / right-click) ───────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('latexCommenter.pickAndDelete', async () => {
      const all = store.getAll();
      if (all.length === 0) {
        vscode.window.showInformationMessage('No comments to delete.');
        return;
      }
      const items = all.map(c => ({
        label: `$(comment) ${c.commentText}`,
        description: `${c.author} · line ${c.range.startLine + 1}`,
        detail: `"${c.selectedText.slice(0, 80)}"`,
        comment: c,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a comment to delete',
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (!picked) { return; }

      const c = picked.comment;
      try {
        const doc = await vscode.workspace.openTextDocument(c.filePath);
        const text = doc.getText();
        const idx = text.indexOf(c.todoText);
        if (idx !== -1) {
          const ed = await vscode.window.showTextDocument(doc, { preserveFocus: true });
          const start = doc.positionAt(idx);
          const end   = doc.positionAt(idx + c.todoText.length);
          await ed.edit(eb => { eb.delete(new vscode.Range(start, end)); });
        }
      } catch { /* file moved/deleted */ }

      store.delete(c.id);
      vscode.window.setStatusBarMessage('🗑️ Comment deleted', 2000);
    })
  );

  // ── REVEAL COMMENT in editor ───────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('latexCommenter.revealComment', async (comment: Comment) => {
      const doc = await vscode.workspace.openTextDocument(comment.filePath);
      const editor = await vscode.window.showTextDocument(doc);
      const start = new vscode.Position(comment.range.startLine, comment.range.startChar);
      const end   = new vscode.Position(comment.range.endLine,   comment.range.endChar);
      editor.selection = new vscode.Selection(start, end);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
    })
  );
}

export function deactivate(): void {
  highlightDecoration?.dispose();
  hideDecoration?.dispose();
}
