# Tauri WYSIWYG Markdown Editor

A modern, desktop Markdown editor built with [Tauri](https://tauri.app/), [React](https://react.dev/), and [Tiptap](https://tiptap.dev/). Edit Markdown documents with a beautiful WYSIWYG interface and rich text formatting.

## Features

- **WYSIWYG Markdown Editing** - Edit Markdown with a visual interface powered by Tiptap v2
- **File Management** - Open, save, and manage Markdown files with native file dialogs
- **Rich Text Formatting** - Support for bold, italic, lists, code blocks, and more
- **Auto-save** - Automatically save your work at regular intervals
- **Recent Files** - Quick access to recently opened documents
- **Dark Mode Ready** - Built with Tailwind CSS for a modern, responsive UI

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

- [Node.js](https://nodejs.org/) (v16 or later)
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

## Project Structure

```
├── src/                          # React frontend
│   ├── components/              # React components
│   │   ├── Editor/             # Main editor component
│   │   ├── Toolbar/            # Formatting toolbar
│   │   ├── Sidebar/            # File browser sidebar
│   │   └── ui/                 # Reusable UI components
│   ├── stores/                 # Zustand store configuration
│   │   ├── documentStore.ts   # Document state management
│   │   ├── settingsStore.ts   # User settings
│   │   └── uiStore.ts         # UI state
│   ├── hooks/                  # Custom React hooks
│   └── App.tsx                 # Root component
├── src-tauri/                  # Tauri backend
│   ├── src/                    # Rust backend code
│   └── tauri.conf.json        # Tauri configuration
├── index.html                  # Entry HTML
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind configuration
└── package.json               # Dependencies
```

## Scripts

- `pnpm dev` - Start Vite development server
- `pnpm build` - Build frontend with TypeScript checking
- `pnpm preview` - Preview production build
- `pnpm tauri` - Run Tauri CLI commands

## License

MIT
