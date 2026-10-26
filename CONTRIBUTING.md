# Contributing to Podmanager 🤝

Thank you for your interest in contributing to **Podmanager**! We welcome contributions of all kinds: bug fixes, performance improvements, documentation enhancements, and new features.

## 🛠️ Development Environment

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Podman**: v4.0.0 or higher (rootless or rootful)
- **Git**

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/podmanager.git
   cd podmanager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3030`.

4. **Run with custom options:**
   ```bash
   PORT=8080 HOST=127.0.0.1 npm start
   ```

## 🏗️ Monorepo & Workspaces Workflow

Podmanager uses **npm workspaces** to manage packages cleanly:

- **`@podmanager/web`** (`apps/web`): Pure HTML5/CSS/Vanilla JavaScript single-page application.
  - Zero build step or bundling required.
  - Changes to `apps/web/public/` are served immediately on browser refresh.
- **`@podmanager/server`** (`apps/server`): Express.js backend with modular routes and Podman CLI service.

### Useful Workspace Commands

```bash
# Start the application from root
npm start

# Run the complete test suite from root
npm test

# Run tests directly in the server workspace
npm run test --workspace=@podmanager/server
```

## 🧪 Testing Guidelines

Podmanager includes automated sanity and integration tests located under `apps/server/test/`:

- **`apps/server/test/api.test.js`**: Verifies static asset delivery and all GET API endpoints.
- **`apps/server/test/lifecycle.test.js`**: Verifies dynamic operations (pod creation & deletion, volume creation & deletion).

Always make sure all tests pass before submitting a pull request:
```bash
npm test
```

When adding new endpoints or features, please include corresponding automated tests covering both success and error cases.

## 📐 Code Style & Conventions

- **Clean Code & Modularity**: Keep functions focused and well-named. Routes, middlewares, and services should remain decoupled.
- **Zero Frontend Build Step**: We intentionally avoid bundling tools (Webpack, Vite, Rollup) and heavy UI frameworks to maintain instant developer startup and minimal user overhead. Write clean, modern ES6+ vanilla JavaScript.
- **Security First**:
  - Never use `child_process.exec` with string concatenation.
  - Always use parameter arrays with `child_process.execFile` or `child_process.spawn` via `podman.service.js`.
  - Validate and sanitize request query and body parameters.
- **Responsive & Accessible Design**: UI components and dialogs must render seamlessly on mobile, tablet, and desktop viewports.

## 📬 Submitting a Pull Request (PR)

1. Create a feature branch from `master` or `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages.
3. Verify that tests pass cleanly (`npm test`).
4. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a Pull Request on GitHub with a clear description of the problem solved and changes made.

## 📄 License

By contributing to Podmanager, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
