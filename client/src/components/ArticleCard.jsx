import { useState } from 'react';
import axios from 'axios';

function ArticleCard({ article }) {
  const [punchline, setPunchline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPunchline = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/summarize', {
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url
      });

      setPunchline(response.data.punchline);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate punchline');
      console.error('Error generating punchline:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="article-card">
      {article.urlToImage && (
        <img
          src={article.urlToImage}
          alt={article.title}
          className="article-image"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}

      <div className="article-content">
        <div className="article-source">
          {article.source?.name || 'Unknown Source'}
        </div>

        <h2 className="article-title">{article.title}</h2>

        {article.description && (
          <p className="article-description">{article.description}</p>
        )}

        <div className="article-actions">
          <button
            className="btn btn-primary"
            onClick={getPunchline}
            disabled={loading}
          >
            {loading ? '🎯 Crafting...' : '🎤 Get Punchline'}
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Read Full
          </a>
        </div>

        {error && (
          <div style={{
            color: '#e74c3c',
            marginTop: '1rem',
            fontSize: '0.9rem',
            padding: '0.5rem',
            background: '#ffe5e5',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        {punchline && (
          <div className="punchline">
            <div className="punchline-label">
              🎯 PUNCHLINE
            </div>
            <div className="punchline-text">
              "{punchline}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArticleCard;
