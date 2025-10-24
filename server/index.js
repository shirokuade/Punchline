import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Punchline API is running' });
});

// Get latest news articles
app.get('/api/news', async (req, res) => {
  try {
    const { category = 'general', country = 'us' } = req.query;

    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country,
        category,
        pageSize: 20,
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching news:', error.message);
    res.status(500).json({
      error: 'Failed to fetch news',
      message: error.message
    });
  }
});

// Generate punchline summary for an article
app.post('/api/summarize', async (req, res) => {
  try {
    const { title, description, content, url } = req.body;

    if (!title && !description && !content) {
      return res.status(400).json({
        error: 'Please provide article title, description, or content'
      });
    }

    // Combine available text for better context
    const articleText = [title, description, content]
      .filter(Boolean)
      .join('\n\n');

    // Use Claude to generate a punchline-style summary
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `You are a master of concise, informative communication. Your task is to create a "punchline" summary - a sharp 1-2 sentence summary that delivers the MOST IMPORTANT and USEFUL information from this article.

Your summary MUST:
- Include specific facts, numbers, names, or concrete details (what actually happened)
- Explain WHY this matters or what the key impact/implication is
- Be informative and actionable first, clever second
- Answer: "What's the core news?" and "Why should I care?"
- Avoid vague generalizations - be SPECIFIC

BAD example (too vague): "Company launches new product to change the market"
GOOD example: "Apple's Vision Pro starts at $3,499 and ships February 2024, targeting enterprise users before consumers"

Article:
${articleText}

Provide ONLY the punchline summary with specific details, nothing else.`
        }
      ]
    });

    const punchline = message.content[0].text;

    res.json({
      punchline,
      source: url
    });
  } catch (error) {
    console.error('Error generating summary:', error.message);
    res.status(500).json({
      error: 'Failed to generate punchline',
      message: error.message
    });
  }
});

// Search news by keyword
app.get('/api/search', async (req, res) => {
  try {
    const { q, sortBy = 'publishedAt' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q,
        sortBy,
        pageSize: 20,
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error searching news:', error.message);
    res.status(500).json({
      error: 'Failed to search news',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🎤 Punchline server running on http://localhost:${PORT}`);
  console.log(`📰 Ready to deliver some punchlines!`);
});
