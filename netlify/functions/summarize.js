import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function handler(event) {
  console.log('=== SUMMARIZE FUNCTION CALLED ===');
  console.log('Environment check:', {
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
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
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not found in environment');
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

    const { title, description, content, url, userProfile } = JSON.parse(event.body || '{}');

    console.log('Request data:', {
      hasTitle: !!title,
      hasDescription: !!description,
      hasContent: !!content,
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

    // Combine available text for better context
    const articleText = [title, description, content]
      .filter(Boolean)
      .join('\n\n');

    // Use user's interests or default to business and tech
    const interests = userProfile || 'business and tech';

    console.log('Calling Anthropic API...');
    console.log('Article length:', articleText.length);
    console.log('User interests:', interests);

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

    console.log('✅ Successfully generated punchline');
    console.log('Punchline length:', punchline.length);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        punchline,
        source: url
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
