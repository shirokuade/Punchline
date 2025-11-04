import { useState, useEffect } from 'react'
import axios from 'axios'
import ArticleCard from './components/ArticleCard'
import UrlSummarizer from './components/UrlSummarizer'

const CATEGORIES = ['general', 'business', 'technology', 'entertainment', 'sports', 'science', 'health'];

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userProfile, setUserProfile] = useState(() => {
    // Load saved profile from localStorage or use default
    const saved = localStorage.getItem('punchline_user_profile');
    return saved || 'business and tech';
  });

  // Save user profile to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('punchline_user_profile', userProfile);
  }, [userProfile]);

  useEffect(() => {
    fetchNews(1); // Reset to page 1 when category changes
  }, [category]);

  const fetchNews = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await axios.get('/api/news', {
        params: {
          category,
          page,
          pageSize: 20
        }
      });

      const newArticles = response.data.articles || [];

      if (append) {
        setArticles(prev => [...prev, ...newArticles]);
      } else {
        setArticles(newArticles);
      }

      setCurrentPage(page);

      // Check if there are more articles
      const totalResults = response.data.totalResults || 0;
      setHasMore(page * 20 < totalResults);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch news. Please check your API key.');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    if (searchQuery) {
      handleSearch(null, nextPage, true);
    } else {
      fetchNews(nextPage, true);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    setHasMore(true);
    fetchNews(1, false);
  };

  const handleSearch = async (e, page = 1, append = false) => {
    if (e) e.preventDefault();

    if (!searchQuery.trim()) {
      fetchNews(1);
      return;
    }

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await axios.get('/api/search', {
        params: {
          q: searchQuery,
          page,
          pageSize: 20
        }
      });

      const newArticles = response.data.articles || [];

      if (append) {
        setArticles(prev => [...prev, ...newArticles]);
      } else {
        setArticles(newArticles);
      }

      setCurrentPage(page);

      const totalResults = response.data.totalResults || 0;
      setHasMore(page * 20 < totalResults);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search news');
      console.error('Error searching news:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setSearchQuery('');
    setCurrentPage(1);
    setHasMore(true);
  };

  return (
    <div className="app">
      <header>
        <h1>🎤 Punchline</h1>
        <p>AI-powered article summaries that hit like a punchline</p>
        <div className="profile-section">
          <label htmlFor="userProfile">My interests:</label>
          <input
            id="userProfile"
            type="text"
            className="profile-input"
            placeholder="e.g., business and tech, climate change, AI research, healthcare innovation"
            value={userProfile}
            onChange={(e) => setUserProfile(e.target.value)}
          />
          <small className="profile-hint">
            💾 Auto-saved • Punchlines will highlight facts relevant to your interests
          </small>
        </div>
      </header>

      {/* URL Summarizer Section */}
      <UrlSummarizer userProfile={userProfile} />

      <div className="section-divider">
        <span>OR BROWSE NEWS</span>
      </div>

      <div className="controls">
        <form className="search-box" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search for news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        <div className="category-filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-btn ${category === cat && !searchQuery ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="news-actions">
        <button
          className="btn-refresh"
          onClick={handleRefresh}
          disabled={loading}
        >
          🔄 Refresh News
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="no-articles">
          No articles found. Try a different search or category.
        </div>
      ) : (
        <>
          <div className="articles-grid">
            {articles.map((article, index) => (
              <ArticleCard key={`${article.url}-${index}`} article={article} userProfile={userProfile} />
            ))}
          </div>

          {hasMore && (
            <div className="load-more-container">
              <button
                className="btn-load-more"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? '⏳ Loading More...' : '📰 Load More Articles'}
              </button>
              <p className="load-more-hint">
                Showing {articles.length} articles • Page {currentPage}
              </p>
            </div>
          )}

          {!hasMore && articles.length > 0 && (
            <div className="end-message">
              🎯 You've reached the end! Try refreshing or changing categories.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
