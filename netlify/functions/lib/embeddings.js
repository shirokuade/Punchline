import OpenAI from 'openai';

let openaiClient = null;

/**
 * Get or create OpenAI client
 */
function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
}

/**
 * Generate embedding for article text
 * Uses OpenAI text-embedding-3-small (768 dimensions)
 * Cost: $0.00002 per 1K tokens (~$0.00001 per article)
 */
export async function generateEmbedding(text) {
  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit to ~8K chars for safety
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embedding from article data
 */
export async function generateArticleEmbedding(article) {
  // Combine title, description, and content for better representation
  const text = [
    article.title,
    article.description,
    article.content
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000); // Limit text length

  return await generateEmbedding(text);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return similarity;
}
