# Database Design - Hybrid Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│         SQL Database (Supabase)              │
│  - Articles (structured data)                │
│  - Summaries (cached text)                   │
│  - User profiles                             │
│  - Metadata, analytics                       │
└─────────────────────────────────────────────┘
              ↕ (article_id references)
┌─────────────────────────────────────────────┐
│      Vector Database (Pinecone)              │
│  - Article embeddings (768D vectors)         │
│  - Fast similarity search                    │
│  - Deduplication lookups                     │
└─────────────────────────────────────────────┘
```

---

## SQL Schema (PostgreSQL/Supabase)

### Articles Table
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  source TEXT,
  category TEXT,
  published_at TIMESTAMP,
  discovered_at TIMESTAMP DEFAULT NOW(),

  -- Deduplication
  canonical_article_id UUID REFERENCES articles(id), -- Points to "main" version if duplicate
  similarity_score FLOAT, -- How similar to canonical (0-1)

  -- Processing
  status TEXT DEFAULT 'pending', -- pending, processing, completed, duplicate, failed
  embedding_id TEXT, -- Reference to vector DB

  -- Metadata
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_articles_url ON articles(url);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_canonical ON articles(canonical_article_id);
CREATE INDEX idx_articles_embedding ON articles(embedding_id);
```

### Summaries Table
```sql
CREATE TABLE summaries (
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

  UNIQUE(article_id, user_profile) -- One summary per article per profile
);

CREATE INDEX idx_summaries_article_id ON summaries(article_id);
CREATE INDEX idx_summaries_user_profile ON summaries(user_profile);
```

### User Profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Vector Database Schema (Pinecone)

### Index Configuration
```javascript
// Pinecone index setup
const index = pinecone.Index("punchline-articles");

// Vector structure
{
  id: "uuid-from-sql",              // Matches articles.id
  values: [0.1, -0.3, 0.8, ...],   // 768D embedding vector
  metadata: {
    url: "https://...",
    title: "Article title",
    source: "CNN",
    category: "technology",
    published_at: "2025-01-15T10:00:00Z"
  }
}
```

### Index Specs
- **Dimensions**: 768 (if using OpenAI text-embedding-3-small)
- **Metric**: cosine (similarity measure)
- **Pods**: 1 pod (free tier)

---

## Workflow: Adding New Article

### Step 1: Check if URL exists (SQL)
```javascript
const existing = await supabase
  .from('articles')
  .select('id, status')
  .eq('url', articleUrl)
  .single();

if (existing) {
  return existing; // Already processed
}
```

### Step 2: Generate embedding
```javascript
import { OpenAI } from 'openai';

const openai = new OpenAI();

const embeddingResponse = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: `${article.title}\n\n${article.content}`,
});

const embedding = embeddingResponse.data[0].embedding; // 768D vector
```

### Step 3: Check for similar articles (Vector DB)
```javascript
const similarResults = await index.query({
  vector: embedding,
  topK: 1,
  includeMetadata: true
});

const bestMatch = similarResults.matches[0];

if (bestMatch && bestMatch.score > 0.90) {
  // 90%+ similar = duplicate!

  // Mark as duplicate in SQL
  await supabase
    .from('articles')
    .insert({
      url: articleUrl,
      title: article.title,
      content: article.content,
      status: 'duplicate',
      canonical_article_id: bestMatch.id, // Link to original
      similarity_score: bestMatch.score
    });

  return { isDuplicate: true, canonicalId: bestMatch.id };
}
```

### Step 4: Store new article (SQL + Vector DB)
```javascript
// Store in SQL
const { data: newArticle } = await supabase
  .from('articles')
  .insert({
    url: articleUrl,
    title: article.title,
    content: article.content,
    status: 'pending',
    embedding_id: `emb_${uuid()}`
  })
  .select()
  .single();

// Store embedding in Vector DB
await index.upsert([{
  id: newArticle.id,
  values: embedding,
  metadata: {
    url: articleUrl,
    title: article.title,
    source: article.source,
    category: article.category
  }
}]);

// Queue for summarization
await summaryQueue.add('summarize', { articleId: newArticle.id });
```

---

## Query Patterns

### Pattern 1: Get cached summary (SQL only)
```javascript
// Mobile app requests summary
const summary = await supabase
  .from('summaries')
  .select('summary, created_at')
  .eq('article_id', articleId)
  .eq('user_profile', 'business and tech')
  .single();

if (summary) {
  return summary; // Cache hit! ✅
}
```

### Pattern 2: Find related articles (Vector DB)
```javascript
// Find articles similar to current reading
const relatedArticles = await index.query({
  vector: currentArticleEmbedding,
  topK: 5,
  includeMetadata: true
});

// Fetch full details from SQL
const articleIds = relatedArticles.matches.map(m => m.id);
const fullArticles = await supabase
  .from('articles')
  .select('*, summaries(*)')
  .in('id', articleIds);
```

### Pattern 3: Semantic search (Vector + SQL)
```javascript
// User searches: "AI regulation Europe"
const searchEmbedding = await generateEmbedding("AI regulation Europe");

const results = await index.query({
  vector: searchEmbedding,
  topK: 20,
  filter: { category: "technology" }
});

// Get summaries from SQL
const articles = await supabase
  .from('articles')
  .select('*, summaries!inner(*)')
  .in('id', results.matches.map(m => m.id))
  .eq('summaries.user_profile', userProfile);
```

---

## Cost Comparison

### Embeddings Cost (OpenAI)
```
text-embedding-3-small: $0.00002 per 1K tokens
Average article: 500 tokens
Cost per embedding: $0.00001

1 million articles: $10
```

### Vector DB Cost (Pinecone Free Tier)
```
1 pod (free tier):
- 100K vectors
- 1 index
- Good for ~50K-100K articles

Cost: $0/month
```

### SQL Database Cost (Supabase Free Tier)
```
500MB database
Good for ~100K articles with summaries

Cost: $0/month
```

---

## Advantages of Hybrid Approach

| Feature | SQL Only | Vector Only | Hybrid (SQL + Vector) |
|---------|----------|-------------|----------------------|
| Exact lookup | ✅ Fast | ❌ Slow | ✅ Fast |
| Similarity search | ❌ Impossible | ✅ Fast | ✅ Fast |
| Structured queries | ✅ Full SQL | ❌ Limited | ✅ Full SQL |
| Deduplication | ❌ URL only | ✅ Semantic | ✅ Best of both |
| Cost at scale | ✅ Cheap | ⚠️ Moderate | ✅ Optimized |
| Complex relationships | ✅ Joins | ❌ No joins | ✅ Joins |

---

## Alternative: Pgvector (PostgreSQL Extension)

**If you want to keep it simple**, use Supabase with pgvector:

```sql
-- Enable vector extension
CREATE EXTENSION vector;

-- Add embedding column to articles table
ALTER TABLE articles
ADD COLUMN embedding vector(768);

-- Create vector similarity index
CREATE INDEX ON articles
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Query similar articles
SELECT id, title, 1 - (embedding <=> query_embedding) as similarity
FROM articles
WHERE 1 - (embedding <=> query_embedding) > 0.9
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**Pros:**
- ✅ Single database (simpler)
- ✅ Free with Supabase
- ✅ Good for <100K vectors

**Cons:**
- ⚠️ Slower than dedicated vector DB at scale
- ⚠️ Less optimized for similarity search

---

## Recommendation

### Start Simple (Month 1-2)
```
Supabase with pgvector
- Everything in one database
- Free tier
- Easy to manage
```

### Scale Later (Month 3+)
```
Supabase (SQL) + Pinecone (Vector)
- Better performance at scale
- Specialized tools for each job
- Still free tier for both
```

---

## Summary

**Use SQL for:**
- Primary data storage
- Exact lookups
- Filtering and sorting
- Analytics

**Use Vector DB for:**
- Deduplication
- Similarity search
- Recommendations
- Semantic search

**Together they create a powerful, cost-efficient system!** 🚀
