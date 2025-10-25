# Deploying Punchline to Netlify

This guide will help you deploy the Punchline app to Netlify.

## Prerequisites

- A GitHub account
- A Netlify account (free tier works!)
- API Keys:
  - Anthropic API key from https://console.anthropic.com/
  - NewsAPI key from https://newsapi.org/

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

If you haven't already:

```bash
# Make sure you're on the right branch
git checkout claude/micdrop-011CURbqBg3QoYAJEQAKum2M

# Push to GitHub
git push -u origin claude/micdrop-011CURbqBg3QoYAJEQAKum2M
```

### 2. Connect to Netlify

1. Go to https://app.netlify.com/
2. Sign in or create an account (you can use GitHub to sign in)
3. Click **"Add new site"**
4. Select **"Import an existing project"**

### 3. Connect Your Repository

1. Choose **GitHub** as your Git provider
2. Authorize Netlify to access your GitHub repositories
3. Search for and select your **Punchline** repository
4. Select the branch: `claude/micdrop-011CURbqBg3QoYAJEQAKum2M`

### 4. Configure Build Settings

Netlify should auto-detect settings from `netlify.toml`, but verify:

- **Build command**: `cd client && npm install && npm run build`
- **Publish directory**: `client/dist`
- **Functions directory**: `netlify/functions`

Click **"Deploy site"** (don't worry, it will fail first - we need to add environment variables)

### 5. Add Environment Variables

1. After the first deploy, go to **Site settings**
2. Click **Environment variables** in the left sidebar
3. Click **"Add a variable"**
4. Add these two variables:

   **Variable 1:**
   - Key: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key (from https://console.anthropic.com/)

   **Variable 2:**
   - Key: `NEWS_API_KEY`
   - Value: Your NewsAPI key (from https://newsapi.org/)

5. Click **"Save"**

### 6. Redeploy

1. Go to **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait for the build to complete (usually 1-2 minutes)

### 7. Your Site is Live!

Once deployed, Netlify will give you a URL like:
`https://your-site-name.netlify.app`

You can customize this URL in **Site settings** → **Site details** → **Change site name**

## Troubleshooting

### Build Fails

- Check the build logs in the Netlify dashboard
- Make sure all environment variables are set correctly
- Verify your API keys are valid

### Functions Not Working

- Check the Functions tab in Netlify dashboard for error logs
- Verify environment variables are set (not just in build settings)
- Test the functions individually at `/.netlify/functions/news`

### News Not Loading

- Verify your `NEWS_API_KEY` is valid
- NewsAPI free tier has rate limits (100 requests/day)
- Check the browser console for errors

### Punchlines Not Generating

- Verify your `ANTHROPIC_API_KEY` is valid
- Check you have credits in your Anthropic account
- View function logs in Netlify dashboard

## Custom Domain (Optional)

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow the instructions to configure DNS

## Monitoring

- **Analytics**: Enable in Site settings → Analytics
- **Functions logs**: Deploys → Functions tab
- **Error tracking**: Integrated with Netlify

## Cost

- **Netlify**: Free tier includes:
  - 100GB bandwidth/month
  - 125k function requests/month
  - Unlimited sites

- **Anthropic API**: Pay per use (Claude Sonnet ~$3 per million tokens)
- **NewsAPI**: Free tier = 100 requests/day, Developer tier = $449/month for more

For a personal project, the free tiers should be sufficient!
