# Punchline Engine - Full Architecture

## Database Schema

### 1. Articles Table
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  source TEXT,
  published_at TIMESTAMP,
  discovered_at TIMESTAMP DEFAULT NOW(),
  category TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_articles_url ON articles(url);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category ON articles(category);
```

### 2. Summaries Table
```sql
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_profile TEXT NOT NULL, -- e.g., "business and tech"
  summary TEXT NOT NULL,
  model_used TEXT, -- e.g., "claude-sonnet-4-5-20250929"
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(article_id, user_profile) -- One summary per article per profile
);

CREATE INDEX idx_summaries_article_id ON summaries(article_id);
CREATE INDEX idx_summaries_user_profile ON summaries(user_profile);
```

### 3. User Profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- e.g., "business and tech"
  description TEXT,
  usage_count INTEGER DEFAULT 0, -- Track popularity
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO user_profiles (name, description) VALUES
  ('business and tech', 'Business news and technology'),
  ('climate change', 'Environmental and climate news'),
  ('healthcare', 'Medical and healthcare innovation'),
  ('AI research', 'Artificial intelligence and machine learning');
```

### 4. Crawl Jobs Table (For tracking crawler)
```sql
CREATE TABLE crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'newsapi', 'rss_feed', etc.
  category TEXT,
  status TEXT DEFAULT 'running', -- running, completed, failed
  articles_found INTEGER DEFAULT 0,
  articles_new INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);
```

---

## System Components

### 1. Crawler Service (Background Worker)
- Runs every 30 minutes (configurable)
- Sources: NewsAPI, RSS feeds, custom scrapers
- Discovers new articles
- Inserts into `articles` table (status: pending)

### 2. Summarization Engine (Background Worker)
- Polls `articles` table for pending items
- For each article:
  - Gets all popular user profiles from `user_profiles`
  - Generates summaries for top 5-10 profiles
  - Stores in `summaries` table
  - Updates article status to 'completed'
- Batch processing for efficiency

### 3. API Service (Express/Netlify Functions)
- Mobile apps call: GET /api/summary?url=...&profile=...
- Flow:
  1. Check if article exists in DB
  2. Check if summary exists for that profile
  3. If yes → return cached summary (instant!)
  4. If no → trigger on-demand summarization → cache → return
- Analytics: Track which profiles are most popular

### 4. Deduplication Service
- Use embeddings to detect similar/duplicate articles
- Prevent wasting money on duplicate summaries

---

## Tech Stack Recommendations

### Database
- **Option 1: Supabase** (PostgreSQL + real-time + auth + storage)
  - Free tier: 500MB database
  - Built-in REST API
  - Real-time subscriptions
  - Easy deployment

- **Option 2: MongoDB Atlas** (NoSQL)
  - Free tier: 512MB storage
  - Flexible schema
  - Good for varying article structures

### Background Workers
- **BullMQ** (Redis-based job queue)
  - Scheduled jobs
  - Retry logic
  - Job prioritization

### Web Crawler
- **Puppeteer** (for JS-heavy sites)
- **Cheerio** (for static HTML - faster)
- **NewsAPI** (already using)
- **RSS Parser** (for RSS feeds)

### Vector Database (For Deduplication)
- **Pinecone** (Free tier: 1 index, 100k vectors)
- **Weaviate** (Open source, self-hosted)
- Use OpenAI embeddings to detect similar articles

### Hosting
- **Crawler + Workers**: Railway, Render, Fly.io
- **API**: Netlify Functions (current) or Vercel
- **Database**: Supabase or MongoDB Atlas
- **Queue**: Upstash Redis (serverless)

---

## Cost Analysis

### Current (On-Demand Only)
- User requests article → $0.003 per summary
- 10,000 requests = $30
- Slow (wait for LLM each time)

### With Caching (Your Vision)
- Summarize once → Cache → Serve 1000s of users
- Example:
  - 100 new articles/day
  - 10 profiles each = 1,000 summaries/day
  - Cost: $3/day
  - Serve unlimited mobile app users for FREE (cached)
  - **10x-100x cost reduction at scale!**

---

## Implementation Phases

### Phase 1: Database + API (Foundation)
1. Set up Supabase/MongoDB
2. Create database schema
3. Update API to check DB first, then LLM
4. Cache all user-requested summaries

### Phase 2: Basic Crawler
1. Scheduled job (every 30 min)
2. Pull from NewsAPI
3. Store new articles in DB
4. Mark as 'pending'

### Phase 3: Background Summarization
1. Worker process polls pending articles
2. Summarizes for top user profiles
3. Stores in DB
4. Marks article as 'completed'

### Phase 4: Deduplication
1. Generate embeddings for articles
2. Check similarity before summarizing
3. Link duplicates to same summary

### Phase 5: Mobile API
1. REST API for mobile apps
2. Authentication
3. Usage analytics
4. Rate limiting

---

## LangChain - Now It Makes Sense!

With your vision, **LangChain CAN help**:

### 1. Document Loaders
```javascript
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";

// Crawl and extract article content
const loader = new CheerioWebBaseLoader(articleUrl);
const docs = await loader.load();
```

### 2. Caching
```javascript
import { ChatAnthropic } from "@langchain/anthropic";
import { InMemoryCache } from "langchain/cache/memory";

const llm = new ChatAnthropic({
  cache: new InMemoryCache(), // Cache LLM responses
});
```

### 3. Vector Stores (Deduplication)
```javascript
import { PineconeStore } from "langchain/vectorstores/pinecone";

// Check if similar article already exists
const similarDocs = await vectorStore.similaritySearch(newArticle, 1);
if (similarDocs[0].score > 0.95) {
  // Use existing summary
}
```

### 4. Batch Processing
```javascript
import { PromptTemplate } from "langchain/prompts";

const chain = PromptTemplate.fromTemplate(template).pipe(llm);

// Batch summarize multiple articles
await chain.batch([article1, article2, article3]);
```

---

## Next Steps - What Do You Want to Build First?

I can help you build this step-by-step:

**Option A: Quick Win** - Add database caching to current app
- Set up Supabase
- Cache user-requested summaries
- Check DB before calling LLM

**Option B: Full Engine** - Build the complete system
- Design full architecture
- Set up all components
- Automated crawler + summarizer

**Option C: Mobile-First** - API for mobile apps
- REST API endpoints
- Authentication
- Usage tracking

Which direction interests you most? 🚀
