import axios from 'axios';

export async function handler(event) {
  console.log('=== NEWS FUNCTION CALLED ===');
  console.log('Environment check:', {
    hasNewsApiKey: !!process.env.NEWS_API_KEY,
    newsApiKeyLength: process.env.NEWS_API_KEY?.length || 0,
    nodeVersion: process.version
  });

  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    if (!process.env.NEWS_API_KEY) {
      console.error('❌ NEWS_API_KEY not found in environment');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'NEWS_API_KEY not configured',
          message: 'Please add NEWS_API_KEY in Netlify environment variables'
        })
      };
    }

    const {
      category = 'general',
      country = 'us',
      page = '1',
      pageSize = '20'
    } = event.queryStringParameters || {};

    console.log('Fetching news:', { category, country, page, pageSize });

    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country,
        category,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    console.log('✅ News API response:', {
      status: response.data.status,
      totalResults: response.data.totalResults,
      articlesCount: response.data.articles?.length || 0
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('❌ Error fetching news:', error);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    // Better error messages for common issues
    if (error.response?.status === 401) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Invalid News API key',
          message: 'Your NEWS_API_KEY is invalid. Get a free key at https://newsapi.org/'
        })
      };
    }

    if (error.response?.status === 426) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'News API upgrade required',
          message: 'Your NewsAPI key requires an upgrade for this request.'
        })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to fetch news',
        message: error.response?.data?.message || error.message,
        details: error.response?.data || 'No additional details'
      })
    };
  }
}
