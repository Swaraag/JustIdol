# How to Start the Development Server

## Quick Start

To start the development server, run:

```bash
source ~/.nvm/nvm.sh && pnpm dev
```

Your app will be available at: **http://localhost:5173** (or the next available port if 5173 is busy)

## Why the `source` command?

You have nvm (Node Version Manager) installed. The `source ~/.nvm/nvm.sh` command loads nvm into your current terminal session so that Node.js and pnpm commands are available.

## Making it Easier (Optional)

To avoid typing `source ~/.nvm/nvm.sh` every time, you can add it to your shell profile. Run this command:

```bash
echo 'source ~/.nvm/nvm.sh' >> ~/.zshrc
```

Then reload your shell:
```bash
source ~/.zshrc
```

After that, you can simply run:
```bash
pnpm dev
```

## Available Ports

The app is currently running on:
- http://localhost:5176 (newest instance)
- http://localhost:5173, 5174, 5175 (older instances - you may want to stop these)

## Other Useful Commands

- Install dependencies: `pnpm install`
- Build for production: `pnpm build`
- Preview production build: `pnpm preview`

