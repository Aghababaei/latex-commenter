# LaTeX Commenter

**Inline review comments for `.tex` files — visible in VS Code and in the compiled PDF.**

Created by [Amin Aghababaei](https://github.com/Aghababaei).

---

## Features

### 💬 Add a Comment
Highlight any word or sentence in a `.tex` file. A **💬 Add Comment** button appears above the selection (or right-click → *LaTeX: Add Comment to Selection*). Type your note — it's saved instantly.

### ✨ Clean Editor View
Commented text is marked with a **yellow highlight**. The underlying `\todo{...}` tag is collapsed to a subtle 💬 icon so it doesn't interrupt reading the source. Hover over any highlighted region to see the full comment with author and timestamp.

### 📄 Margin Notes in the PDF
Comments are injected as `\todo[color=yellow!40]{...}` annotations. The `\usepackage{todonotes}` line is added to your preamble automatically on first use. Recompile with `pdflatex` and the comment appears as a **yellow margin note** — just like Word's comment sidebar.

### 🗂️ Comment Management Sidebar
Open the **Explorer** panel in VS Code and scroll down to **LaTeX Comments**. All comments are listed grouped by file. Click a comment to jump to it in the editor. Hover and click the 🗑️ trash icon to delete.

### 🔍 Delete via Command Palette
Press `⌘+Shift+P` and run **LaTeX: Delete a Comment...** to pick any comment from a searchable list and remove it from both the sidebar and the `.tex` file.

### 📤 Export Comments
Run **LaTeX: Export Comments to File** from the sidebar title bar to save all comments for the current file as a plain-text `.txt` file — useful for sharing review notes with collaborators who don't use VS Code.

---

## Installation (No Coding Required)

You can install this extension directly from the `.vsix` file — no terminal, no Node.js, no build steps.

### Step 1 — Download the VSIX file

Go to the [**Releases**](https://github.com/Aghababaei/latex-commenter/releases) page and download the latest `latex-commenter-x.x.x.vsix` file to your computer.

### Step 2 — Open VS Code

Launch Visual Studio Code. If you don't have it yet, download it free from [code.visualstudio.com](https://code.visualstudio.com).

### Step 3 — Open the Extensions panel

Click the **Extensions** icon in the left Activity Bar (looks like four squares), or press:
- **Windows / Linux:** `Ctrl+Shift+X`
- **macOS:** `⌘+Shift+X`

### Step 4 — Open the "Install from VSIX" option

In the Extensions panel, click the **`···`** (three-dot menu) button in the top-right corner of the panel, then select **"Install from VSIX…"**

### Step 5 — Select the downloaded file

A file picker will open. Navigate to the `.vsix` file you downloaded in Step 1, select it, and click **Install**.

### Step 6 — Reload VS Code

Once installation finishes, VS Code will show a prompt. Click **Reload Window** (or simply close and reopen VS Code) to activate the extension.

**Done!** Open any `.tex` file, select some text, and a `💬 Add Comment` button will appear above your selection.

---

## Usage

| Action | How |
|---|---|
| Add comment | Select text → click `💬 Add Comment` CodeLens, or right-click |
| View comment | Hover over yellow-highlighted text |
| Delete comment | `⌘+Shift+P` → *LaTeX: Delete a Comment...*, or use sidebar 🗑️ |
| Jump to comment | Click any comment in the LaTeX Comments sidebar panel |
| Export comments | Sidebar title bar → export icon |
| Clear all | Sidebar title bar → clear icon |

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `latexCommenter.authorName` | *(blank)* | Your name on comments. Set once — never asked again. |
| `latexCommenter.highlightColor` | `rgba(255,220,0,0.35)` | Background color of commented regions. |
| `latexCommenter.showCodeLens` | `true` | Show/hide the `💬 Add Comment` button above selections. |

---

## Requirements

- VS Code 1.85 or later
- A LaTeX distribution (e.g. [MacTeX](https://www.tug.org/mactex/) on macOS, TeX Live on Linux/Windows) for PDF compilation

---

## How Comments Appear in the PDF

The extension injects `\todo[color=yellow!40]{Author: comment}` after the selected text and automatically adds `\usepackage[colorinlistoftodos]{todonotes}` to your preamble. Rerun `pdflatex yourfile.tex` to see the yellow margin notes.

To compile:
```bash
pdflatex yourfile.tex
```

---

## Author

**[Amin Aghababaei](https://github.com/Aghababaei)**  
Built for research teams who collaborate on LaTeX documents and need a lightweight, friendly review workflow directly inside VS Code.

---

## License

MIT
