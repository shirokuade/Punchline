import axios from 'axios';
import * as cheerio from 'cheerio';

export async function handler(event) {
  console.log('=== EXTRACT FUNCTION CALLED ===');

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
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');

    if (!url) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'URL is required',
          message: 'Please provide a valid article URL'
        })
      };
    }

    console.log('Fetching URL:', url);

    // Fetch the webpage
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove script and style tags
    $('script, style, nav, header, footer, iframe, .ad, .advertisement').remove();

    // Try to extract title
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                $('h1').first().text() ||
                '';

    // Try to extract description
    let description = $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="description"]').attr('content') ||
                      $('meta[name="twitter:description"]').attr('content') ||
                      '';

    // Try to extract main content
    let content = '';

    // Try common article selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        if (content.length > 200) {
          break;
        }
      }
    }

    // Fallback: get all paragraphs
    if (content.length < 200) {
      content = $('p').map((i, el) => $(el).text()).get().join('\n\n');
    }

    // Clean up the content
    title = title.trim().slice(0, 500);
    description = description.trim().slice(0, 1000);
    content = content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000); // Limit content length

    // Try to extract image
    let imageUrl = $('meta[property="og:image"]').attr('content') ||
                   $('meta[name="twitter:image"]').attr('content') ||
                   $('article img').first().attr('src') ||
                   '';

    // Try to extract source/domain
    const urlObj = new URL(url);
    const source = urlObj.hostname.replace('www.', '');

    console.log('Extracted article:', {
      titleLength: title.length,
      descriptionLength: description.length,
      contentLength: content.length,
      hasImage: !!imageUrl,
      source
    });

    if (!title && !content) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Failed to extract content',
          message: 'Could not find article content on this page. The site might be protected or have a complex layout.'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        title,
        description,
        content,
        source,
        imageUrl
      })
    };
  } catch (error) {
    console.error('Error extracting article:', error);

    let errorMessage = 'Failed to fetch article';
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'URL not found or domain does not exist';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. The website might be slow or blocking requests.';
    } else if (error.response?.status === 403) {
      errorMessage = 'Access denied. The website might be blocking automated requests.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Article not found (404)';
    }

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: errorMessage,
        message: error.message,
        details: error.response?.statusText || 'Unknown error'
      })
    };
  }
}
