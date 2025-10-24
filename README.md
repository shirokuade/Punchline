# Punchline 🎤

An AI-powered web app that summarizes articles into punchy, meaningful 1-2 sentence summaries - like the punchline of a joke!

## Features

- 📰 **News Discovery**: Browse fresh news articles from various sources
- 🤖 **AI Punchline Summaries**: Get concise, impactful summaries using Claude AI
- 🎯 **Clean UI**: Modern, responsive interface for easy reading

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude API
- **News**: NewsAPI.org

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and add your API keys:
   - Get Anthropic API key from: https://console.anthropic.com/
   - Get News API key from: https://newsapi.org/
3. Install dependencies:
   ```bash
   npm run install-all
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`

## Usage

1. Browse fresh news articles on the home page
2. Click on any article to read it
3. Click "Get Punchline" to generate an AI-powered summary
4. Enjoy the concise, punchy summary!

## API Endpoints

- `GET /api/news` - Fetch latest news articles
- `POST /api/summarize` - Generate punchline summary for an article

## License

MIT
