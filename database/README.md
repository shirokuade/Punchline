# Database Folder

This folder contains database schema and migration files for Punchline.

## Files

### schema.sql
Complete PostgreSQL schema for Punchline with pgvector extension.

**Tables:**
- `articles` - Stores article metadata and embeddings
- `summaries` - Cached AI-generated summaries
- `user_profiles` - User interest profiles (e.g., "business and tech")
- `crawl_jobs` - Tracking for automated crawlers
- `api_analytics` - Usage analytics and cache performance

**Functions:**
- `find_similar_articles()` - Vector similarity search
- `update_updated_at_column()` - Auto-update timestamps

**Views:**
- `summary_stats` - Overall statistics
- `cache_performance` - Cache hit rates by day

## How to Use

### Initial Setup
1. Create Neon database at https://neon.tech
2. Copy connection string
3. Run schema.sql in Neon SQL Editor

### Running Schema
```sql
-- In Neon SQL Editor, paste and run:
-- (contents of schema.sql)
```

### Verifying Installation
```sql
-- Check tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public';

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check default user profiles
SELECT * FROM user_profiles;
```

### Useful Queries

**See recent articles:**
```sql
SELECT id, title, url, created_at
FROM articles
ORDER BY created_at DESC
LIMIT 10;
```

**Check cache statistics:**
```sql
SELECT * FROM summary_stats;
```

**View cache performance:**
```sql
SELECT * FROM cache_performance
ORDER BY date DESC
LIMIT 7;
```

**Find similar articles:**
```sql
SELECT * FROM find_similar_articles(
  (SELECT embedding FROM articles WHERE id = 'article-id-here'),
  0.90, -- 90% similarity threshold
  5     -- top 5 results
);
```

**Check most popular user profiles:**
```sql
SELECT name, usage_count
FROM user_profiles
ORDER BY usage_count DESC;
```

## Migrations

For future schema changes, create migration files:
- `001_initial_schema.sql` (this file)
- `002_add_new_column.sql`
- `003_add_index.sql`
- etc.

## Backup

**Export database:**
```bash
pg_dump $DATABASE_URL > backup.sql
```

**Restore database:**
```bash
psql $DATABASE_URL < backup.sql
```

## Notes

- pgvector extension must be enabled first
- HNSW index is used for vector similarity (faster than IVFFlat)
- 768 dimensions matches OpenAI text-embedding-3-small
- Cascading deletes: deleting article deletes its summaries
- Unique constraint: one summary per (article, user_profile) pair
