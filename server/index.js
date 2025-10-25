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
    const { title, description, content, url, userProfile } = req.body;

    if (!title && !description && !content) {
      return res.status(400).json({
        error: 'Please provide article title, description, or content'
      });
    }

    // Combine available text for better context
    const articleText = [title, description, content]
      .filter(Boolean)
      .join('\n\n');

    // Use user's interests or default to business and tech
    const interests = userProfile || 'business and tech';

    // Use Claude to generate a punchline-style summary
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are a master of concise, informative communication. Create a 2-sentence "punchline" summary:

SENTENCE 1: A sharp, punchy summary that captures the core news with specific details (what happened and why it matters).

SENTENCE 2: List the 5 most important facts from the article, BUT ONLY include facts relevant to someone interested in ${interests.toUpperCase()}. Filter out facts about other topics.

User Profile: Interest in ${interests}

Format:
[Punchy summary sentence]. [Key fact 1], [key fact 2], [key fact 3], [key fact 4], and [key fact 5].

Example:
"OpenAI launched Atlas browser with built-in ChatGPT at $20/month, directly challenging Chrome's dominance. The browser includes AI-powered tab management, automatic code review for developers, integration with Microsoft 365, a new revenue-sharing model for content creators, and releases March 2024 for Pro subscribers."

Article:
${articleText}

Provide ONLY the 2-sentence punchline with facts relevant to the user's interests, nothing else.`
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
