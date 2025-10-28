import pg from 'pg';
const { Pool } = pg;

// Connection pool (reused across function invocations)
let pool = null;

/**
 * Get or create database connection pool
 */
export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10, // Maximum connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  return pool;
}

/**
 * Check if article exists by URL
 */
export async function findArticleByUrl(url) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM articles WHERE url = $1',
    [url]
  );
  return result.rows[0] || null;
}

/**
 * Insert or update article
 */
export async function upsertArticle(articleData) {
  const pool = getPool();
  const {
    url,
    title,
    description,
    content,
    source,
    category,
    image_url,
    published_at
  } = articleData;

  const result = await pool.query(
    `INSERT INTO articles (url, title, description, content, source, category, image_url, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (url) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       content = EXCLUDED.content,
       updated_at = NOW()
     RETURNING *`,
    [url, title, description, content, source, category, image_url, published_at]
  );

  return result.rows[0];
}

/**
 * Find cached summary for article and user profile
 */
export async function findCachedSummary(articleId, userProfile) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT s.*, a.url, a.title
     FROM summaries s
     JOIN articles a ON s.article_id = a.id
     WHERE s.article_id = $1 AND s.user_profile = $2`,
    [articleId, userProfile]
  );
  return result.rows[0] || null;
}

/**
 * Save summary to cache
 */
export async function cacheSummary(summaryData) {
  const pool = getPool();
  const {
    article_id,
    user_profile,
    summary,
    model_used,
    tokens_used,
    cost_usd
  } = summaryData;

  const result = await pool.query(
    `INSERT INTO summaries (article_id, user_profile, summary, model_used, tokens_used, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (article_id, user_profile) DO UPDATE SET
       summary = EXCLUDED.summary,
       model_used = EXCLUDED.model_used,
       tokens_used = EXCLUDED.tokens_used,
       cost_usd = EXCLUDED.cost_usd
     RETURNING *`,
    [article_id, user_profile, summary, model_used, tokens_used, cost_usd]
  );

  return result.rows[0];
}

/**
 * Store article embedding
 */
export async function storeEmbedding(articleId, embedding) {
  const pool = getPool();
  const result = await pool.query(
    'UPDATE articles SET embedding = $1 WHERE id = $2 RETURNING *',
    [`[${embedding.join(',')}]`, articleId]
  );
  return result.rows[0];
}

/**
 * Find similar articles using vector similarity
 */
export async function findSimilarArticles(embedding, threshold = 0.90, limit = 5) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM find_similar_articles($1::vector, $2, $3)`,
    [`[${embedding.join(',')}]`, threshold, limit]
  );
  return result.rows;
}

/**
 * Log API analytics
 */
export async function logAnalytics(data) {
  const pool = getPool();
  const {
    endpoint,
    article_url,
    user_profile,
    cache_hit,
    response_time_ms
  } = data;

  await pool.query(
    `INSERT INTO api_analytics (endpoint, article_url, user_profile, cache_hit, response_time_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [endpoint, article_url, user_profile, cache_hit, response_time_ms]
  );
}

/**
 * Increment user profile usage count
 */
export async function incrementProfileUsage(profileName) {
  const pool = getPool();
  await pool.query(
    'UPDATE user_profiles SET usage_count = usage_count + 1 WHERE name = $1',
    [profileName]
  );
}

/**
 * Get summary statistics
 */
export async function getSummaryStats() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM summary_stats');
  return result.rows[0];
}

/**
 * Get cache performance
 */
export async function getCachePerformance(days = 7) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM cache_performance LIMIT $1',
    [days]
  );
  return result.rows;
}

/**
 * Close database pool (for cleanup)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
