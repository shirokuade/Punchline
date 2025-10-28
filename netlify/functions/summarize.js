import Anthropic from '@anthropic-ai/sdk';
import {
  findArticleByUrl,
  upsertArticle,
  findCachedSummary,
  cacheSummary,
  storeEmbedding,
  findSimilarArticles,
  logAnalytics,
  incrementProfileUsage
} from './lib/database.js';
import { generateArticleEmbedding } from './lib/embeddings.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function handler(event) {
  const startTime = Date.now();

  console.log('=== SUMMARIZE FUNCTION CALLED ===');
  console.log('Environment check:', {
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    nodeVersion: process.version
  });

  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not found');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'ANTHROPIC_API_KEY not configured',
          message: 'Please add ANTHROPIC_API_KEY in Netlify environment variables'
        })
      };
    }

    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL not found - caching disabled');
    }

    const { title, description, content, url, userProfile } = JSON.parse(event.body || '{}');

    console.log('Request data:', {
      hasTitle: !!title,
      hasDescription: !!description,
      hasContent: !!content,
      hasUrl: !!url,
      userProfile
    });

    if (!title && !description && !content) {
      console.log('❌ Missing article data');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Please provide article title, description, or content'
        })
      };
    }

    const interests = userProfile || 'business and tech';
    let cacheHit = false;
    let article = null;

    // Try database caching if available
    if (process.env.DATABASE_URL && url) {
      try {
        console.log('🔍 Checking database cache...');

        // Check if article exists
        article = await findArticleByUrl(url);

        if (article) {
          console.log('✅ Article found in database:', article.id);

          // Check for cached summary
          const cached = await findCachedSummary(article.id, interests);

          if (cached) {
            console.log('🎯 Cache HIT! Returning cached summary');
            cacheHit = true;

            // Log analytics
            await logAnalytics({
              endpoint: 'summarize',
              article_url: url,
              user_profile: interests,
              cache_hit: true,
              response_time_ms: Date.now() - startTime
            });

            await incrementProfileUsage(interests);

            return {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                'X-Cache': 'HIT'
              },
              body: JSON.stringify({
                punchline: cached.summary,
                source: url,
                cached: true,
                cachedAt: cached.created_at
              })
            };
          }

          console.log('❌ Cache MISS for this user profile');
        } else {
          console.log('📝 New article - storing in database');

          // Store new article
          article = await upsertArticle({
            url,
            title,
            description,
            content,
            source: null,
            category: null,
            image_url: null,
            published_at: null
          });

          console.log('✅ Article stored:', article.id);

          // Generate and store embedding asynchronously (don't block response)
          if (process.env.OPENAI_API_KEY) {
            generateArticleEmbedding({ title, description, content })
              .then(embedding => storeEmbedding(article.id, embedding))
              .then(() => console.log('✅ Embedding stored'))
              .catch(err => console.error('⚠️ Failed to store embedding:', err));
          }
        }
      } catch (dbError) {
        console.error('⚠️ Database error (continuing without cache):', dbError);
        // Continue without caching if database fails
      }
    }

    // Cache MISS or no database - generate summary with LLM
    console.log('🤖 Generating new summary with Claude...');

    const articleText = [title, description, content]
      .filter(Boolean)
      .join('\n\n');

    console.log('Article length:', articleText.length);
    console.log('User interests:', interests);

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

    console.log('✅ Successfully generated punchline');
    console.log('Punchline length:', punchline.length);

    // Cache the summary if database is available
    if (process.env.DATABASE_URL && article) {
      try {
        const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
        const costUsd = (tokensUsed / 1000000) * 3; // Rough estimate: $3 per 1M tokens

        await cacheSummary({
          article_id: article.id,
          user_profile: interests,
          summary: punchline,
          model_used: 'claude-sonnet-4-5-20250929',
          tokens_used: tokensUsed,
          cost_usd: costUsd
        });

        console.log('✅ Summary cached for future requests');

        // Log analytics
        await logAnalytics({
          endpoint: 'summarize',
          article_url: url,
          user_profile: interests,
          cache_hit: false,
          response_time_ms: Date.now() - startTime
        });

        await incrementProfileUsage(interests);
      } catch (cacheError) {
        console.error('⚠️ Failed to cache summary:', cacheError);
        // Don't fail the request if caching fails
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      },
      body: JSON.stringify({
        punchline,
        source: url,
        cached: false
      })
    };
  } catch (error) {
    console.error('❌ Error generating summary:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to generate punchline',
        message: error.message,
        details: error.response?.data || 'No additional details'
      })
    };
  }
}
