import { useState } from 'react';
import axios from 'axios';

function ArticleCard({ article, userProfile }) {
  const [punchline, setPunchline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cached, setCached] = useState(false);

  const getPunchline = async () => {
    // If we already have the punchline, just flip the card
    if (punchline) {
      setIsFlipped(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/summarize', {
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        userProfile: userProfile || 'business and tech'
      });

      setPunchline(response.data.punchline);
      setCached(response.data.cached || false);
      setIsFlipped(true); // Flip to show the punchline
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate punchline');
      console.error('Error generating punchline:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFlipBack = () => {
    setIsFlipped(false);
  };

  return (
    <div className={`article-card-container ${isFlipped ? 'flipped' : ''}`}>
      <div className="article-card-flipper">
        {/* FRONT SIDE */}
        <div className="article-card article-card-front">
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
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* BACK SIDE */}
        <div className="article-card article-card-back">
          <div className="punchline-container">
            <div className="punchline-header">
              <span className="punchline-label">🎤 PUNCHLINE</span>
              {cached && <span className="cached-badge">CACHED</span>}
            </div>

            <div className="punchline-content">
              <p className="punchline-text">"{punchline}"</p>
            </div>

            <div className="article-back-info">
              <div className="article-source-small">
                {article.source?.name || 'Unknown Source'}
              </div>
              <h3 className="article-title-small">{article.title}</h3>
            </div>

            <div className="article-actions">
              <button
                className="btn btn-primary"
                onClick={handleFlipBack}
              >
                ↩️ Flip Back
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArticleCard;
