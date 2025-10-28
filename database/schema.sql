-- Punchline Database Schema for Neon PostgreSQL

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  source TEXT,
  category TEXT,
  image_url TEXT,
  published_at TIMESTAMP,
  discovered_at TIMESTAMP DEFAULT NOW(),

  -- Deduplication fields
  canonical_article_id UUID REFERENCES articles(id),
  similarity_score FLOAT,

  -- Processing status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, duplicate, failed

  -- Vector embedding (768 dimensions for OpenAI text-embedding-3-small)
  embedding vector(768),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for articles
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_canonical ON articles(canonical_article_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- Vector similarity index using HNSW (faster than IVFFlat for small-medium datasets)
CREATE INDEX IF NOT EXISTS idx_articles_embedding ON articles
USING hnsw (embedding vector_cosine_ops);

-- Summaries table (cached AI-generated summaries)
CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_profile TEXT NOT NULL,
  summary TEXT NOT NULL,

  -- LLM tracking
  model_used TEXT,
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),

  -- One summary per article per user profile
  UNIQUE(article_id, user_profile)
);

-- Indexes for summaries
CREATE INDEX IF NOT EXISTS idx_summaries_article_id ON summaries(article_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_profile ON summaries(user_profile);
CREATE INDEX IF NOT EXISTS idx_summaries_created ON summaries(created_at DESC);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default user profiles
INSERT INTO user_profiles (name, description, is_active) VALUES
  ('business and tech', 'Business news and technology trends', true),
  ('climate change', 'Environmental and climate-related news', true),
  ('healthcare', 'Medical and healthcare innovation', true),
  ('AI research', 'Artificial intelligence and machine learning', true),
  ('politics', 'Political news and policy', true)
ON CONFLICT (name) DO NOTHING;

-- Crawl jobs table (for tracking automated crawling)
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'running', -- running, completed, failed
  articles_found INTEGER DEFAULT 0,
  articles_new INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Analytics table (track API usage)
CREATE TABLE IF NOT EXISTS api_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  article_url TEXT,
  user_profile TEXT,
  cache_hit BOOLEAN DEFAULT false,
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_created ON api_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_hit ON api_analytics(cache_hit);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to find similar articles
CREATE OR REPLACE FUNCTION find_similar_articles(
  query_embedding vector(768),
  similarity_threshold FLOAT DEFAULT 0.90,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  article_id UUID,
  article_url TEXT,
  article_title TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    url,
    title,
    1 - (embedding <=> query_embedding) as similarity
  FROM articles
  WHERE
    embedding IS NOT NULL
    AND (1 - (embedding <=> query_embedding)) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- View for summary statistics
CREATE OR REPLACE VIEW summary_stats AS
SELECT
  COUNT(DISTINCT a.id) as total_articles,
  COUNT(DISTINCT s.id) as total_summaries,
  COUNT(DISTINCT s.user_profile) as unique_profiles,
  SUM(s.cost_usd) as total_cost,
  AVG(s.tokens_used) as avg_tokens_per_summary
FROM articles a
LEFT JOIN summaries s ON a.id = s.article_id;

-- View for cache hit rate
CREATE OR REPLACE VIEW cache_performance AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
  ROUND(100.0 * SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) / COUNT(*), 2) as cache_hit_rate
FROM api_analytics
GROUP BY DATE(created_at)
ORDER BY date DESC;
