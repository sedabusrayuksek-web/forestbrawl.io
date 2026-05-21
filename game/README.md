# ForestBrawl.io - Game Server & Frontend

Multiplayer browser-based game with real-time gameplay using Node.js, Express, Socket.io, and a custom HTML5 game engine.

## 🏗️ Architecture

### Backend (`artifacts/api-server/`)
- **Express.js** server with Socket.io for real-time multiplayer
- **Node.js** based game simulation
- **Authentication**: JWT-based token system with SHA256 hashing
- **Endpoints**:
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `GET /api/auth/me` - Get current user info
  - `GET /api/leaderboard` - Get leaderboard (daily/weekly/all/kills tabs)
  - `POST /api/leaderboard/submit` - Submit game score
  - `GET /api/health` - Health check

### Frontend (`artifacts/forestbrawl/`)
- **Vite** build tool with TypeScript support
- **Game Engine**: Custom HTML5 Canvas-based multiplayer game
- **Real-time Communication**: Socket.io for player synchronization
- **UI Components**: Radix UI + Tailwind CSS
- **Assets**: Progressive Web App with manifest

## 📦 Features

### Gameplay
- **Real-time Multiplayer**: 1v1 or team-based battles
- **Resource Gathering**: Wood, stone, gold, food, etc.
- **Combat System**: Axes and swords with damage calculation
- **Building System**: Place defensive structures
- **Progression**: XP, ranks, and unlockable items

### Ranking System
- **Daily Leaderboard**: Resets every day
- **Weekly Leaderboard**: Resets every Monday
- **All-time Leaderboard**: Never resets
- **Kills Leaderboard**: Tracks total kills

### User System
- **Authentication**: Secure registration and login
- **Profile**: User stats (kills, deaths, wins, playtime)
- **Inventory**: Owned items and equipped gear
- **Progression**: Rank system based on XP

## 🚀 Deployment

### Prerequisites
- Node.js 24.14.0 (see `.nvmrc`)
- pnpm 9+ (package manager)

### Local Development

```bash
cd artifacts

# Install dependencies
pnpm install

# Development mode (builds and starts with hot reload)
pnpm dev

# Or start directly
PORT=8080 pnpm start
```

The server will start at `http://localhost:8080`
- Game: http://localhost:8080/forestbrawl/
- API: http://localhost:8080/api/

### Build for Production

```bash
cd artifacts

# Install dependencies and build all packages
pnpm install
pnpm run build

# Or build individually
pnpm --filter @workspace/forestbrawl run build
pnpm --filter @workspace/api-server run build
```

### Running Built Application

```bash
cd artifacts
PORT=8080 node --enable-source-maps api-server/dist/index.cjs
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:24-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install

# Build
RUN pnpm run build

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Run
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.cjs"]
```

### Render.com Deployment

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `cd artifacts && pnpm install && pnpm run build`
   - **Start Command**: `node --enable-source-maps artifacts/api-server/dist/index.cjs`
   - **Port**: `8080`
   - **Environment Variables**:
     - `NODE_ENV=production`
     - `PORT=8080`
     - `SESSION_SECRET=your-secure-random-string` (generate a strong secret)

## 📋 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `NODE_ENV` | production | Environment mode |
| `SESSION_SECRET` | forestbrawl-default-secret-change-me | JWT signing secret |

⚠️ **Important**: Change `SESSION_SECRET` in production!

## 🛠️ Project Structure

```
artifacts/
├── api-server/              # Backend server
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── app.ts          # Express app setup
│   │   ├── game-server.ts  # Socket.io game logic
│   │   ├── routes/         # API routes
│   │   ├── lib/            # Utilities (auth, logger, etc)
│   │   └── data/           # Database functions
│   ├── dist/               # Built files
│   └── package.json
│
├── forestbrawl/            # Frontend game
│   ├── index.html          # Game UI and inline JavaScript
│   ├── play.html           # Gameplay screen
│   ├── public/             # Static assets
│   ├── vite.config.ts
│   └── dist/public/        # Built files
│
└── mockup-sandbox/         # Component previews (optional)
    └── src/
```

## 🔐 Security Notes

1. **Default Session Secret**: The default JWT secret in `api-server/src/lib/auth.ts` should be changed in production
2. **Password Hashing**: Uses HMAC-SHA256 with salt
3. **CORS**: Configured to allow all origins (consider restricting in production)
4. **Validation**: Input validation on registration (3-24 character usernames, 6+ character passwords)

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Use a different port
PORT=3000 pnpm start
```

### Module Not Found Errors
```bash
# Rebuild with fresh dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

### Socket.io Connection Issues
- Verify `path: '/api/socket.io'` matches in both frontend and backend
- Check that WebSocket transport is not blocked by proxy/firewall
- Server path: `artifacts/api-server/src/game-server.ts`
- Client path: `artifacts/forestbrawl/index.html` (search for `lobbySocket`)

### Frontend Not Loading
- Ensure build completed: `ls artifacts/forestbrawl/dist/public/`
- Verify API server serves correct path: `http://localhost:8080/forestbrawl/`
- Check browser console for errors

## 📊 Data Storage

- **Users**: `artifacts/api-server/data/users.json`
- **Leaderboard**: `artifacts/api-server/data/leaderboard.json`

⚠️ Note: Currently using JSON file storage. For production with multiple instances, use a database like MongoDB or PostgreSQL.

## 🤝 Contributing

1. Make changes to source files in `src/`
2. Rebuild with `pnpm run build`
3. Test locally before deployment
4. Commit and push to main branch

## 📝 License

MIT

## ✨ Version

1.0.0
