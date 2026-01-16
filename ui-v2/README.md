# Vite + React + TypeScript + Jotai + shadcn-ui

A modern React development stack with TypeScript, Jotai state management, shadcn-ui components, and comprehensive tooling.

## 🚀 Tech Stack

- **Build Tool**: Vite
- **Framework**: React 19
- **Language**: TypeScript
- **State Management**: Jotai
- **UI Components**: shadcn-ui
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Testing Library
- **Code Quality**: ESLint + Prettier

## 📦 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## 🧪 Testing

Run tests:

```bash
npm run test
```

Run tests with UI:

```bash
npm run test:ui
```

Run tests with coverage:

```bash
npm run test:coverage
```

## 🎨 Code Quality

### Linting

```bash
npm run lint
npm run lint:fix
```

### Formatting

```bash
npm run format
npm run format:check
```

## 📁 Project Structure

```
src/
├── components/        # React components
│   └── ui/           # shadcn-ui components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions
├── store/            # Jotai atoms and state
└── test/             # Test setup and utilities
```

## 🔧 Adding shadcn-ui Components

To add components from shadcn-ui:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
# ... and more
```

## 📝 Notes

- Path aliases are configured with `@/` pointing to `src/`
- Tailwind CSS with CSS variables for theming
- Dark mode support built-in
- Vitest configured with jsdom for component testing
- ESLint and Prettier integrated for consistent code style

## 🤝 Contributing

Feel free to customize this scaffold according to your project needs!
