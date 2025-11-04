import { useState } from 'react';
import axios from 'axios';

function UrlSummarizer({ userProfile }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (must include http:// or https://)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Extract article content from URL
      console.log('Extracting article from URL...');
      const extractResponse = await axios.post('/api/extract', {
        url: url.trim()
      });

      const articleData = extractResponse.data;
      console.log('Article extracted:', articleData.title);

      // Step 2: Generate summary
      console.log('Generating punchline...');
      const summaryResponse = await axios.post('/api/summarize', {
        title: articleData.title,
        description: articleData.description,
        content: articleData.content,
        url: articleData.url,
        userProfile
      });

      setResult({
        ...articleData,
        punchline: summaryResponse.data.punchline,
        cached: summaryResponse.data.cached
      });
    } catch (err) {
      console.error('Error processing URL:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to process URL. Make sure the URL is accessible and contains an article.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setUrl('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="url-summarizer">
      <h2>📎 Summarize Any Article</h2>
      <p className="url-hint">Paste any article URL and get an instant punchline summary</p>

      <form onSubmit={handleSubmit} className="url-form">
        <input
          type="text"
          className="url-input"
          placeholder="https://example.com/article..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? '⏳ Processing...' : '🎤 Get Punchline'}
        </button>
        {(url || result) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClear}
            disabled={loading}
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="url-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="url-result">
          <div className="url-result-header">
            <h3>{result.title}</h3>
            <span className="url-result-source">{result.source}</span>
          </div>

          {result.imageUrl && (
            <img
              src={result.imageUrl}
              alt={result.title}
              className="url-result-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}

          {result.description && (
            <p className="url-result-description">{result.description}</p>
          )}

          <div className="punchline">
            <div className="punchline-label">
              🎯 PUNCHLINE
              {result.cached && <span className="cached-badge">⚡ Cached</span>}
            </div>
            <div className="punchline-text">
              "{result.punchline}"
            </div>
          </div>

          <div className="url-result-actions">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-small"
            >
              Read Original Article →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default UrlSummarizer;
