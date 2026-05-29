import * as vscode from 'vscode';
import { CommentStore, Comment } from './commentStore';

// ── Tree item for a file group ─────────────────────────────────────────────
class FileItem extends vscode.TreeItem {
  constructor(public readonly filePath: string, commentCount: number) {
    super(
      vscode.workspace.asRelativePath(filePath),
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.description = `${commentCount} comment${commentCount !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('file-text');
    this.contextValue = 'file';
  }
}

// ── Tree item for a single comment ────────────────────────────────────────
class CommentItem extends vscode.TreeItem {
  constructor(public readonly comment: Comment) {
    super(comment.commentText, vscode.TreeItemCollapsibleState.None);

    const shortQuote =
      comment.selectedText.length > 40
        ? comment.selectedText.slice(0, 40) + '…'
        : comment.selectedText;

    this.description = `"${shortQuote}"`;
    this.tooltip = new vscode.MarkdownString(
      `**${comment.author}** · ${comment.timestamp}\n\n` +
      `> ${comment.selectedText}\n\n` +
      comment.commentText
    );
    this.iconPath = new vscode.ThemeIcon('comment');
    this.contextValue = 'comment';

    // Clicking navigates to the location in the file
    this.command = {
      command: 'latexCommenter.revealComment',
      title: 'Reveal',
      arguments: [comment],
    };
  }
}

type TreeNode = FileItem | CommentItem;

// ── TreeDataProvider ───────────────────────────────────────────────────────
export class CommentTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private store: CommentStore) {
    store.onChange(() => this._onDidChangeTreeData.fire());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      // Root: group by file
      const all = this.store.getAll();
      const files = [...new Set(all.map(c => c.filePath))];
      return files.map(f => new FileItem(f, this.store.getForFile(f).length));
    }

    if (element instanceof FileItem) {
      return this.store.getForFile(element.filePath).map(c => new CommentItem(c));
    }

    return [];
  }
}
