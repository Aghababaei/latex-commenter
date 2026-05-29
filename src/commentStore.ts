import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Comment {
  id: string;
  filePath: string;
  selectedText: string;
  commentText: string;
  author: string;
  timestamp: string;
  todoText: string;   // the exact \todo{...} string injected into the .tex file
  range: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  };
}

export class CommentStore {
  private comments: Map<string, Comment[]> = new Map();
  private storageFile: string;
  private _onChange = new vscode.EventEmitter<void>();
  readonly onChange = this._onChange.event;

  constructor(private context: vscode.ExtensionContext) {
    this.storageFile = path.join(context.globalStorageUri.fsPath, 'comments.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data: Comment[] = JSON.parse(raw);
        for (const c of data) {
          const list = this.comments.get(c.filePath) ?? [];
          list.push(c);
          this.comments.set(c.filePath, list);
        }
      }
    } catch {
      // Start fresh if corrupted
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
      const all: Comment[] = [];
      this.comments.forEach(list => all.push(...list));
      fs.writeFileSync(this.storageFile, JSON.stringify(all, null, 2), 'utf-8');
    } catch (e) {
      vscode.window.showErrorMessage(`LaTeX Commenter: Failed to save comments – ${e}`);
    }
  }

  add(comment: Comment): void {
    const list = this.comments.get(comment.filePath) ?? [];
    list.push(comment);
    this.comments.set(comment.filePath, list);
    this.save();
    this._onChange.fire();
  }

  delete(id: string): void {
    for (const [file, list] of this.comments) {
      const idx = list.findIndex(c => c.id === id);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) { this.comments.delete(file); }
        this.save();
        this._onChange.fire();
        return;
      }
    }
  }

  getForFile(filePath: string): Comment[] {
    return this.comments.get(filePath) ?? [];
  }

  getAll(): Comment[] {
    const all: Comment[] = [];
    this.comments.forEach(list => all.push(...list));
    return all;
  }

  clearForFile(filePath: string): void {
    this.comments.delete(filePath);
    this.save();
    this._onChange.fire();
  }

  clearAll(): void {
    this.comments.clear();
    this.save();
    this._onChange.fire();
  }

  /** Export all comments for a file as a readable text block */
  exportAsText(filePath: string): string {
    const list = this.getForFile(filePath);
    if (list.length === 0) { return '(No comments for this file)'; }
    return list
      .map((c, i) =>
        `[${i + 1}] ${c.author} — ${c.timestamp}\n` +
        `  Quoted: "${c.selectedText}"\n` +
        `  Line ${c.range.startLine + 1}: ${c.commentText}`
      )
      .join('\n\n');
  }
}
