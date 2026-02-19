# MarkBear

A beautiful desktop Markdown editor with a clean, visual writing experience. Write and edit Markdown documents naturally.

## Screenshots

<table>
  <tr>
    <td><img src="./screenshots/home.png" alt="Home Page" width="100%"></td>
    <td><img src="./screenshots/home_without_sidebar.png" alt="Home Without Sidebar Page" width="100%"></td>
  </tr>
</table>

## Features

- **Visual Markdown Editing** — Write and edit Markdown the way you see it, without dealing with raw symbols
- **File Management** — Open, save, and manage your Markdown files using native system dialogs
- **Rich Text Formatting** — Bold, italic, lists, code blocks, blockquotes, and more — all at your fingertips
- **Auto-save** — Your work is saved automatically at regular intervals, so you never lose progress
- **Multiple Themes** — Choose from seven built-in UI themes

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Editor**: Tiptap v2 with extensions
- **Desktop**: Tauri v2
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with shadcn/ui patterns
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [Rust](https://www.rust-lang.org/) (for Tauri desktop builds)

### Development

Start the development server with hot reload:

```bash
pnpm dev
```

For Tauri-specific development:

```bash
pnpm tauri dev
```

### Building

Create an optimized production build:

```bash
pnpm build
```

Create the desktop application:

```bash
pnpm tauri build
```

## License

MIT
