export type ThemeName = 'github-light' | 'github-dark' | 'dracula' | 'nord-light' | 'nord-dark' | 'solarized-light' | 'solarized-dark';

export interface ThemeDefinition {
  name: string;
  displayName: string;
  variant: 'light' | 'dark';
  colors: {
    // Background colors
    bgPrimary: string;
    bgSecondary: string;
    bgCode: string;
    bgBlockquote: string;
    bgInlineCode: string;
    bgSelection: string;
    
    // Text colors
    textPrimary: string;
    textHeading: string;
    textMuted: string;
    
    // Link colors
    linkColor: string;
    linkHover: string;
    linkVisited: string;
    
    // Border colors
    borderColor: string;
    borderMuted: string;
    borderBlockquote: string;
    
    // Syntax highlighting
    syntaxKeyword: string;
    syntaxString: string;
    syntaxNumber: string;
    syntaxComment: string;
    syntaxFunction: string;
    syntaxVariable: string;
    syntaxOperator: string;
    syntaxClass: string;
    syntaxTag: string;
    
    // Special elements
    tableHeaderBg: string;
    tableHeaderText: string;
    tableRowAlt: string;
    checkboxChecked: string;
    checkboxUnchecked: string;
  };
}

export const THEME_NAMES: Record<ThemeName, ThemeDefinition> = {
  // GitHub Light
  'github-light': {
    name: 'github-light',
    displayName: 'GitHub Light',
    variant: 'light',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f6f8fa',
      bgCode: '#f6f8fa',
      bgBlockquote: '#f6f8fa',
      bgInlineCode: '#eaeef2',
      bgSelection: '#fff8c5',
      textPrimary: '#24292f',
      textHeading: '#0550ae',
      textMuted: '#656d76',
      linkColor: '#0969da',
      linkHover: '#0860ca',
      linkVisited: '#6f42c1',
      borderColor: '#d0d7de',
      borderMuted: '#eaeef2',
      borderBlockquote: '#d0d7de',
      syntaxKeyword: '#d1264e',
      syntaxString: '#0a3069',
      syntaxNumber: '#0550ae',
      syntaxComment: '#656d76',
      syntaxFunction: '#8250df',
      syntaxVariable: '#0550ae',
      syntaxOperator: '#24292f',
      syntaxClass: '#8250df',
      syntaxTag: '#0550ae',
      tableHeaderBg: '#f6f8fa',
      tableHeaderText: '#24292f',
      tableRowAlt: '#f6f8fa',
      checkboxChecked: '#1f6feb',
      checkboxUnchecked: '#d0d7de',
    },
  },
  
  // GitHub Dark
  'github-dark': {
    name: 'github-dark',
    displayName: 'GitHub Dark',
    variant: 'dark',
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      bgCode: '#0d1117',
      bgBlockquote: '#0d1117',
      bgInlineCode: '#161b22',
      bgSelection: '#388bfd26',
      textPrimary: '#e6edf3',
      textHeading: '#79c0ff',
      textMuted: '#8b949e',
      linkColor: '#58a6ff',
      linkHover: '#79c0ff',
      linkVisited: '#bc8ef7',
      borderColor: '#30363d',
      borderMuted: '#21262d',
      borderBlockquote: '#30363d',
      syntaxKeyword: '#ff7b72',
      syntaxString: '#a5d6ff',
      syntaxNumber: '#79c0ff',
      syntaxComment: '#8b949e',
      syntaxFunction: '#d2a8ff',
      syntaxVariable: '#79c0ff',
      syntaxOperator: '#ff7b72',
      syntaxClass: '#d2a8ff',
      syntaxTag: '#79c0ff',
      tableHeaderBg: '#161b22',
      tableHeaderText: '#e6edf3',
      tableRowAlt: '#0d1117',
      checkboxChecked: '#58a6ff',
      checkboxUnchecked: '#30363d',
    },
  },
  
  // Dracula
  'dracula': {
    name: 'dracula',
    displayName: 'Dracula',
    variant: 'dark',
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#1e1f29',
      bgCode: '#21222c',
      bgBlockquote: '#1e1f29',
      bgInlineCode: '#3f404b',
      bgSelection: '#44475a66',
      textPrimary: '#f8f8f2',
      textHeading: '#8be9fd',
      textMuted: '#6272a4',
      linkColor: '#8be9fd',
      linkHover: '#a4ebf7',
      linkVisited: '#bd93f9',
      borderColor: '#44475a',
      borderMuted: '#3f404b',
      borderBlockquote: '#8be9fd',
      syntaxKeyword: '#ff79c6',
      syntaxString: '#f1fa8c',
      syntaxNumber: '#bd93f9',
      syntaxComment: '#6272a4',
      syntaxFunction: '#8be9fd',
      syntaxVariable: '#8be9fd',
      syntaxOperator: '#ff79c6',
      syntaxClass: '#8be9fd',
      syntaxTag: '#ff79c6',
      tableHeaderBg: '#44475a',
      tableHeaderText: '#f8f8f2',
      tableRowAlt: '#21222c',
      checkboxChecked: '#50fa7b',
      checkboxUnchecked: '#44475a',
    },
  },
  
  // Nord Light
  'nord-light': {
    name: 'nord-light',
    displayName: 'Nord Light',
    variant: 'light',
    colors: {
      bgPrimary: '#eceff4',
      bgSecondary: '#e5e9f0',
      bgCode: '#e5e9f0',
      bgBlockquote: '#d8dee9',
      bgInlineCode: '#d8dee9',
      bgSelection: '#d8dee9',
      textPrimary: '#2e3440',
      textHeading: '#5e81ac',
      textMuted: '#4c566a',
      linkColor: '#81a1c1',
      linkHover: '#88c0d0',
      linkVisited: '#b48ead',
      borderColor: '#d8dee9',
      borderMuted: '#e5e9f0',
      borderBlockquote: '#81a1c1',
      syntaxKeyword: '#81a1c1',
      syntaxString: '#a3be8c',
      syntaxNumber: '#b48ead',
      syntaxComment: '#4c566a',
      syntaxFunction: '#88c0d0',
      syntaxVariable: '#81a1c1',
      syntaxOperator: '#2e3440',
      syntaxClass: '#8fbcbb',
      syntaxTag: '#81a1c1',
      tableHeaderBg: '#d8dee9',
      tableHeaderText: '#2e3440',
      tableRowAlt: '#e5e9f0',
      checkboxChecked: '#81a1c1',
      checkboxUnchecked: '#d8dee9',
    },
  },
  
  // Nord Dark
  'nord-dark': {
    name: 'nord-dark',
    displayName: 'Nord Dark',
    variant: 'dark',
    colors: {
      bgPrimary: '#2e3440',
      bgSecondary: '#3b4252',
      bgCode: '#2e3440',
      bgBlockquote: '#3b4252',
      bgInlineCode: '#434c5e',
      bgSelection: '#434c5e66',
      textPrimary: '#eceff4',
      textHeading: '#88c0d0',
      textMuted: '#81a1c1',
      linkColor: '#81a1c1',
      linkHover: '#88c0d0',
      linkVisited: '#b48ead',
      borderColor: '#434c5e',
      borderMuted: '#3b4252',
      borderBlockquote: '#88c0d0',
      syntaxKeyword: '#81a1c1',
      syntaxString: '#a3be8c',
      syntaxNumber: '#b48ead',
      syntaxComment: '#616e88',
      syntaxFunction: '#88c0d0',
      syntaxVariable: '#8fbcbb',
      syntaxOperator: '#81a1c1',
      syntaxClass: '#8fbcbb',
      syntaxTag: '#81a1c1',
      tableHeaderBg: '#3b4252',
      tableHeaderText: '#eceff4',
      tableRowAlt: '#2e3440',
      checkboxChecked: '#a3be8c',
      checkboxUnchecked: '#434c5e',
    },
  },
  
  // Solarized Light
  'solarized-light': {
    name: 'solarized-light',
    displayName: 'Solarized Light',
    variant: 'light',
    colors: {
      bgPrimary: '#fdf6e3',
      bgSecondary: '#eee8d5',
      bgCode: '#eee8d5',
      bgBlockquote: '#eee8d5',
      bgInlineCode: '#eee8d5',
      bgSelection: '#d6d0bf',
      textPrimary: '#657b83',
      textHeading: '#268bd2',
      textMuted: '#93a1a1',
      linkColor: '#268bd2',
      linkHover: '#2aa198',
      linkVisited: '#6c71c4',
      borderColor: '#d6d0bf',
      borderMuted: '#eee8d5',
      borderBlockquote: '#2aa198',
      syntaxKeyword: '#859900',
      syntaxString: '#2aa198',
      syntaxNumber: '#d33682',
      syntaxComment: '#93a1a1',
      syntaxFunction: '#268bd2',
      syntaxVariable: '#268bd2',
      syntaxOperator: '#859900',
      syntaxClass: '#268bd2',
      syntaxTag: '#268bd2',
      tableHeaderBg: '#eee8d5',
      tableHeaderText: '#657b83',
      tableRowAlt: '#fdf6e3',
      checkboxChecked: '#268bd2',
      checkboxUnchecked: '#d6d0bf',
    },
  },
  
  // Solarized Dark
  'solarized-dark': {
    name: 'solarized-dark',
    displayName: 'Solarized Dark',
    variant: 'dark',
    colors: {
      bgPrimary: '#002b36',
      bgSecondary: '#073642',
      bgCode: '#002b36',
      bgBlockquote: '#073642',
      bgInlineCode: '#073642',
      bgSelection: '#073642',
      textPrimary: '#839496',
      textHeading: '#268bd2',
      textMuted: '#586e75',
      linkColor: '#268bd2',
      linkHover: '#2aa198',
      linkVisited: '#6c71c4',
      borderColor: '#073642',
      borderMuted: '#073642',
      borderBlockquote: '#2aa198',
      syntaxKeyword: '#859900',
      syntaxString: '#2aa198',
      syntaxNumber: '#d33682',
      syntaxComment: '#586e75',
      syntaxFunction: '#268bd2',
      syntaxVariable: '#268bd2',
      syntaxOperator: '#859900',
      syntaxClass: '#268bd2',
      syntaxTag: '#268bd2',
      tableHeaderBg: '#073642',
      tableHeaderText: '#839496',
      tableRowAlt: '#002b36',
      checkboxChecked: '#859900',
      checkboxUnchecked: '#073642',
    },
  },
};

export const ALL_THEMES = Object.values(THEME_NAMES);
