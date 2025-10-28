# Punchline Setup Guide - Neon Database Integration

This guide will help you set up the Punchline app with Neon PostgreSQL database for caching and cost optimization.

---

## 🎯 What You're Building

Before: Every user request calls the LLM → expensive
**After**: Cache summaries in database → serve instantly → 10x-100x cost reduction!

---

## 📋 Prerequisites

You'll need API keys for:
1. **Neon** (PostgreSQL database) - FREE
2. **Anthropic** (Claude AI) - Pay per use
3. **NewsAPI** (News articles) - FREE tier
4. **OpenAI** (Embeddings) - ~$0.00001 per article (OPTIONAL)

---

## 🚀 Step 1: Create Neon Database

### 1.1 Sign Up for Neon
1. Go to https://neon.tech
2. Click "Sign up" (free, no credit card)
3. Sign in with GitHub or email

### 1.2 Create Project
1. Click "Create Project"
2. Project name: `punchline-db`
3. Region: Choose closest to your users (e.g., US East)
4. Click "Create Project"

### 1.3 Get Connection String
1. In Neon dashboard, click "Connection Details"
2. Copy the connection string:
   ```
   postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/punchline
   ```
3. Save this! You'll need it for Netlify

---

## 🗄️ Step 2: Set Up Database Schema

### 2.1 Open SQL Editor
1. In Neon dashboard, click "SQL Editor" (left sidebar)

### 2.2 Run Schema Creation
1. Copy the contents of `/database/schema.sql`
2. Paste into SQL Editor
3. Click "Run" or press Ctrl+Enter
4. You should see: "Query executed successfully"

### 2.3 Verify Tables
Run this query to verify:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see:
- ✅ articles
- ✅ summaries
- ✅ user_profiles
- ✅ crawl_jobs
- ✅ api_analytics

---

## 🔐 Step 3: Configure Netlify Environment Variables

### 3.1 Go to Netlify Dashboard
1. https://app.netlify.com
2. Click on your Punchline site
3. Go to **Site settings** → **Environment variables**

### 3.2 Add Required Variables

Click "Add a variable" for each:

**1. DATABASE_URL** (Neon connection string)
```
Key: DATABASE_URL
Value: postgresql://user:password@ep-xxx...
```

**2. ANTHROPIC_API_KEY** (Get from https://console.anthropic.com/)
```
Key: ANTHROPIC_API_KEY
Value: sk-ant-api03-xxxxx...
```

**3. NEWS_API_KEY** (Get from https://newsapi.org/)
```
Key: NEWS_API_KEY
Value: xxxxxxxxxxxxxxxxxxxxxx
```

**4. OPENAI_API_KEY** (OPTIONAL - for embeddings/deduplication)
```
Key: OPENAI_API_KEY
Value: sk-proj-xxxxx...
```

> **Note**: OPENAI_API_KEY is optional. Without it, deduplication won't work, but caching still works!

### 3.3 Save Variables
Click "Save" after adding all variables

---

## 📦 Step 4: Deploy to Netlify

### 4.1 Install Dependencies Locally (Test)
```bash
cd netlify/functions
npm install
```

You should see:
- ✅ axios installed
- ✅ @anthropic-ai/sdk installed
- ✅ pg installed
- ✅ openai installed

### 4.2 Commit and Push
```bash
git add -A
git commit -m "Add Neon database integration with caching"
git push origin selma-punchline-core
```

### 4.3 Deploy on Netlify
1. Go to Netlify dashboard
2. Click **Deploys** tab
3. Click **"Trigger deploy"** → **"Clear cache and deploy site"**
4. Wait 2-3 minutes for build

### 4.4 Check Build Logs
Look for:
```
✅ Installing function dependencies (pg, openai, etc.)
✅ Building functions
✅ Deploy succeeded
```

---

## ✅ Step 5: Test It Works!

### 5.1 Test Without Cache (First Request)
1. Open your Netlify site
2. Click on any article
3. Click "Get Punchline"
4. Watch the response (should take 2-3 seconds)
5. Check browser Network tab → Look for header: `X-Cache: MISS`

### 5.2 Test With Cache (Second Request)
1. Click "Get Punchline" on the SAME article again
2. Should be instant (< 100ms)!
3. Check browser Network tab → Look for header: `X-Cache: HIT`
4. You should see `"cached": true` in response

### 5.3 Check Database
In Neon SQL Editor, run:
```sql
-- Check stored articles
SELECT id, title, url, created_at
FROM articles
ORDER BY created_at DESC
LIMIT 5;

-- Check cached summaries
SELECT s.user_profile, s.summary, s.created_at, a.title
FROM summaries s
JOIN articles a ON s.article_id = a.id
ORDER BY s.created_at DESC
LIMIT 5;

-- Check cache stats
SELECT * FROM summary_stats;
```

---

## 🔍 Step 6: Monitor Performance

### Check Cache Hit Rate
```sql
SELECT * FROM cache_performance
ORDER BY date DESC
LIMIT 7;
```

**Good cache hit rate**: 50%+ (means you're saving money!)

### Check Costs
```sql
SELECT
  user_profile,
  COUNT(*) as summaries,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost
FROM summaries
GROUP BY user_profile
ORDER BY total_cost DESC;
```

---

## 🐛 Troubleshooting

### Issue 1: "DATABASE_URL not configured"
**Fix**: Add DATABASE_URL to Netlify environment variables

### Issue 2: "Cannot find module 'pg'"
**Fix**:
```bash
cd netlify/functions
npm install
git add netlify/functions/package-lock.json
git commit -m "Add pg dependency lock file"
git push
```

### Issue 3: Database connection fails
**Fix**: Check Neon connection string:
- Make sure it starts with `postgresql://`
- Verify username and password are correct
- Check that database exists

### Issue 4: Summaries not caching
**Check Netlify Function logs**:
1. Netlify dashboard → Functions → summarize
2. Look for:
   - `🔍 Checking database cache...`
   - `✅ Article found in database`
   - `🎯 Cache HIT!` or `❌ Cache MISS`

**Common causes**:
- DATABASE_URL not set
- Different article URL (even slight differences = different cache)
- Different user profile

### Issue 5: Embeddings not working
**Fix**: Add OPENAI_API_KEY to Netlify env variables
**Or**: Just skip it! Embeddings are optional (only for deduplication)

---

## 📊 Understanding The Flow

### First Request (Cache MISS)
```
User clicks "Get Punchline"
  ↓
Check database for article (not found)
  ↓
Store article in database
  ↓
Call Claude AI ($0.003)
  ↓
Cache summary in database
  ↓
Return to user (2-3 seconds)
```

### Second Request (Cache HIT)
```
User clicks "Get Punchline"
  ↓
Check database for article (found!)
  ↓
Check database for summary (found!)
  ↓
Return cached summary (instant, FREE!)
```

### Same Article, Different Profile
```
User A with profile "business and tech"
  ↓
Cache MISS → Generate summary → Cache it

User B with profile "climate change"
  ↓
Cache MISS → Generate NEW summary → Cache it

User C with profile "business and tech"
  ↓
Cache HIT → Return User A's cached summary (FREE!)
```

---

## 💰 Cost Comparison

### Before Caching
```
1 article, 100 users request it
= 100 LLM calls
= 100 × $0.003
= $0.30
```

### After Caching
```
1 article, 100 users request it
= 1 LLM call (first request)
= 99 cache hits (FREE)
= 1 × $0.003
= $0.003

Savings: $0.297 (99% cheaper!)
```

---

## 🎉 Next Steps

Now that caching works, you can:

1. **Add More User Profiles**: Edit `database/schema.sql` and add more profiles
2. **Build Crawler**: Automate article discovery
3. **Add Deduplication**: Use embeddings to detect duplicate articles
4. **Mobile API**: Build REST API for mobile apps
5. **Analytics Dashboard**: Visualize cache performance

Check `ARCHITECTURE.md` for the full roadmap!

---

## 📚 Reference

- **Neon Docs**: https://neon.tech/docs
- **pg (PostgreSQL client)**: https://node-postgres.com/
- **Anthropic API**: https://docs.anthropic.com/
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings

---

## 🆘 Need Help?

If you're stuck:
1. Check Netlify Function logs
2. Check Neon SQL Editor for data
3. Verify all environment variables are set
4. Try deploying without OPENAI_API_KEY first (embeddings optional)

Happy caching! 🚀
