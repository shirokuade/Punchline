# Punchline 🎤

An AI-powered web app that summarizes articles into punchy, meaningful 1-2 sentence summaries - like the punchline of a joke!

## Features

- 📰 **News Discovery**: Browse fresh news articles from various sources
- 🤖 **AI Punchline Summaries**: Get concise, impactful summaries using Claude AI
- 🎯 **Clean UI**: Modern, responsive interface for easy reading

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Netlify Functions (serverless)
- **AI**: Anthropic Claude API
- **News**: NewsAPI.org
- **Hosting**: Netlify

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

## Deployment to Netlify

### Quick Deploy

1. **Fork or push this repo to GitHub**

2. **Go to [Netlify](https://app.netlify.com/)** and sign in

3. **Click "Add new site" → "Import an existing project"**

4. **Connect to GitHub** and select your repository

5. **Configure build settings** (these should be auto-detected from `netlify.toml`):
   - Build command: `cd client && npm install && npm run build`
   - Publish directory: `client/dist`
   - Functions directory: `netlify/functions`

6. **Add environment variables** in Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add `ANTHROPIC_API_KEY` with your Anthropic API key
   - Add `NEWS_API_KEY` with your NewsAPI key

7. **Deploy!** Netlify will build and deploy your site

### Manual Deploy via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

When prompted, set:
- Publish directory: `client/dist`
- Functions directory: `netlify/functions`

Then add environment variables in the Netlify dashboard.

### Environment Variables

Required environment variables:
- `ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/
- `NEWS_API_KEY` - Get from https://newsapi.org/

## Local Development

For local development, the app uses Express server:

```bash
npm run dev
```

For production, it uses Netlify Functions (serverless).

## License

MIT
