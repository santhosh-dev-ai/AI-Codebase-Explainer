# AI-Powered Codebase Explainer

A production-grade, enterprise-level web application that helps developers understand large codebases instantly through AI-powered analysis, explanations, and interactive Q&A.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Express](https://img.shields.io/badge/Express-4.18-green)

---

## 🚀 Features

### Core Functionality
- **📂 Repository Input**: Analyze GitHub repositories or upload ZIP files
- **🏗️ Architecture Analysis**: AI-generated high-level architecture explanations
- **📄 File-Level Insights**: Detailed explanations for individual files
- **💬 Interactive Chat**: Ask questions about the codebase in natural language
- **📊 Flow Visualization**: System flow diagrams generated with Mermaid
- **🐛 Bug Detection**: AI-powered identification of potential bugs and security issues
- **✨ Improvement Suggestions**: Code quality and optimization recommendations
- **📈 Dashboard**: Tech stack, file distribution, and complexity metrics

### UI/UX
- **Professional Dark Theme**: Inspired by GitHub, Linear, and VS Code
- **Resizable Panels**: Split-pane layout with persistent sizing
- **Monaco Editor**: Industry-standard code viewer
- **Smooth Animations**: Framer Motion-powered transitions
- **Responsive Design**: Desktop-focused, optimized for developer workflows
- **Skeleton Loaders**: Professional loading states

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **React Query** - Server state management
- **Monaco Editor** - Code editor component
- **Framer Motion** - Animations
- **Axios** - HTTP client

### Backend
- **Node.js + Express** - REST API server
- **TypeScript** - Type safety
- **OpenAI API** - AI-powered analysis
- **Axios** - GitHub API integration
- **JSZip** - ZIP file processing
- **Winston** - Structured logging
- **Multer** - File upload handling

---

## 📁 Project Structure

```
ai-codebase-explainer/
├── backend/                      # Express API Server
│   ├── src/
│   │   ├── config/              # Environment & API configuration
│   │   ├── controllers/         # Request handlers
│   │   ├── services/            # Business logic
│   │   │   ├── repository/      # GitHub & ZIP handling
│   │   │   ├── ai/              # OpenAI integration
│   │   │   ├── analysis/        # Code analysis services
│   │   │   └── storage/         # Session management
│   │   ├── middleware/          # Express middleware
│   │   ├── routes/              # API routes
│   │   ├── types/               # TypeScript types
│   │   ├── utils/               # Utilities
│   │   ├── app.ts               # Express app setup
│   │   └── server.ts            # Server entry point
│   ├── uploads/                 # Temporary file storage
│   ├── sessions/                # Session data
│   └── logs/                    # Application logs
│
└── frontend/                    # Next.js Application
    ├── src/
    │   ├── app/                 # Next.js App Router
    │   │   ├── analyze/         # Analysis page
    │   │   └── page.tsx         # Landing page
    │   ├── components/          # React components
    │   │   ├── ui/              # Reusable UI primitives
    │   │   ├── layout/          # Layout components
    │   │   ├── repository/       # Repository-related
    │   │   ├── editor/          # Monaco editor
    │   │   ├── ai/              # AI components
    │   │   ├── dashboard/       # Dashboard components
    │   │   └── visualization/   # Flow diagrams
    │   ├── hooks/               # Custom React hooks
    │   ├── store/               # Zustand state management
    │   ├── lib/                 # Utilities & API client
    │   ├── types/               # TypeScript types
    │   └── constants/           # Constants & config
    └── public/                  # Static assets
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **GitHub Token** (optional, for private repos)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-codebase-explainer
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

   Create `.env` file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   GITHUB_TOKEN=optional_github_token
   PORT=3001
   NODE_ENV=development
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

   Create `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_ENV=development
   ```

### Running the Application

1. **Start the Backend** (Terminal 1)
   ```bash
   cd backend
   npm run dev
   ```
   Backend will run on `http://localhost:3001`

2. **Start the Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

3. **Open your browser**
   Navigate to `http://localhost:3000`

---

## 🎯 Usage

### Analyze a GitHub Repository

1. On the landing page, select "GitHub URL"
2. Enter a public GitHub repository URL (e.g., `https://github.com/facebook/react`)
3. Click "Analyze Repository"
4. Wait for the analysis to complete (10-30 seconds)

### Upload a ZIP File

1. Select "Upload ZIP"
2. Drag and drop or click to upload a ZIP file of your codebase
3. Click "Analyze Codebase"

### Exploring the Analysis

- **Left Panel**: File tree navigator
- **Center Panel**: Code viewer (Monaco Editor)
- **Right Panel**: AI explanations with tabs:
  - Overview: Architecture and tech stack
  - Explanation: File-level details
  - Bugs: Potential issues
  - Flow: System diagrams
- **Bottom/Floating**: Chat interface for questions

---

## 🏗️ Architecture

### AI Integration Strategy

**Context Management**
- Smart token allocation (8K context window)
- Priority-based context selection
- Efficient chunking with semantic boundaries

**Models Used**
- GPT-4 Turbo: Complex analysis, architecture overviews
- GPT-3.5 Turbo: Simple tasks, file summaries
- text-embedding-3-small: Semantic search (optional)

**Optimizations**
- Streaming responses for better UX
- Aggressive caching (1-24 hour TTL)
- Request deduplication
- Rate limiting

### Large Codebase Handling

- **Filtering**: Excludes node_modules, dist, binaries, etc.
- **Sampling**: For repos > 1000 files, analyzes priority files only
- **Progressive Loading**: On-demand file content fetching
- **Lazy Analysis**: Background processing based on user interaction

---

## 📝 API Endpoints

### Repository Management

```
POST   /api/repository/analyze-github
Body: { githubUrl: string, branch?: string }
Response: { sessionId, fileTree, metadata }

POST   /api/repository/upload-zip
Body: FormData (multipart)
Response: { sessionId, fileTree, metadata }

GET    /api/repository/:sessionId/file?filePath=path/to/file
Response: { path, content, language, size, lines }

GET    /api/repository/:sessionId/tree
Response: { fileTree, metadata }
```

### Analysis (To be implemented)

```
GET    /api/analysis/:sessionId/overview
POST   /api/analysis/:sessionId/file-explanation
POST   /api/analysis/:sessionId/bug-detection
GET    /api/analysis/:sessionId/flow-diagram
```

### Chat (To be implemented)

```
POST   /api/chat/:sessionId/message
GET    /api/chat/:sessionId/history
DELETE /api/chat/:sessionId/history
```

---

## 🧪 Development

### Backend

```bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint

# Format code
npm run format
```

### Frontend

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint

# Format code
npm run format
```

---

## 🚢 Deployment

### Frontend (Vercel - Recommended)

1. Push code to GitHub
2. Create a new project on [Vercel](https://vercel.com)
3. Connect your repository
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Your backend API URL
5. Deploy

### Backend (Railway/Render)

1. Push code to GitHub
2. Create a new service on [Railway](https://railway.app) or [Render](https://render.com)
3. Connect your repository
4. Add environment variables (see `.env.example`)
5. Deploy

---

## 🔐 Environment Variables

### Backend

| Variable | Required | Description | Default |
|---|---------|-------------|---------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key | - |
| `GITHUB_TOKEN` | ❌ | GitHub personal access token | - |
| `PORT` | ❌ | Server port | 3001 |
| `NODE_ENV` | ❌ | Environment | development |
| `MAX_FILE_SIZE` | ❌ | Max upload size (bytes) | 52428800 (50MB) |
| `SESSION_TTL` | ❌ | Session lifetime (seconds) | 3600 (1 hour) |

### Frontend

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL | http://localhost:3001 |
| `NEXT_PUBLIC_ENV` | ❌ | Environment | development |

---

## 🎨 Design System

### Colors (Dark Theme)

- Background: `#0d1117`
- Surface: `#161b22`
- Border: `#30363d`
- Text Primary: `#c9d1d9`
- Text Secondary: `#8b949e`
- Accent: `#58a6ff`
- Success: `#3fb950`
- Warning: `#d29922`
- Error: `#f85149`

### Typography

- UI Font: Inter (400, 500, 600, 700)
- Code Font: JetBrains Mono (400, 500)
- Base Size: 14px

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 API
- **Vercel** for Next.js
- **Monaco Editor** for the code editor component
- **Tailwind CSS** for the styling framework

---

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

## 🗺️ Roadmap

-  GitHub OAuth for private repositories
- [ ] Save and bookmark analyzed repositories
- [ ] Multi-repo comparison
- [ ] Team collaboration features
- [ ] Export analysis as PDF/Markdown
- [ ] Real-time collaboration
- [ ] VS Code extension

---

**Built with ❤️ for developers who love great code**
