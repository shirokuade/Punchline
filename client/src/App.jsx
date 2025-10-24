import { useState, useEffect } from 'react'
import axios from 'axios'
import ArticleCard from './components/ArticleCard'

const CATEGORIES = ['general', 'business', 'technology', 'entertainment', 'sports', 'science', 'health'];

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNews();
  }, [category]);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/news', {
        params: { category }
      });
      setArticles(response.data.articles || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch news. Please check your API key.');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchNews();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/search', {
        params: { q: searchQuery }
      });
      setArticles(response.data.articles || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search news');
      console.error('Error searching news:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setSearchQuery('');
  };

  return (
    <div className="app">
      <header>
        <h1>🎤 Punchline</h1>
        <p>AI-powered article summaries that hit like a punchline</p>
      </header>

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
        <div className="articles-grid">
          {articles.map((article, index) => (
            <ArticleCard key={index} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
