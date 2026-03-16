import React from 'react';
import ReactDOM from 'react-dom/client';
import ClawHQ from './components/ClawHQ';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Keep console logs for debugging in dev.
    // eslint-disable-next-line no-console
    console.error('[MyClaw3D] Uncaught render error', error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || '';
      const comp = this.state.info?.componentStack || '';
      return (
        <div style={{
          width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0f', color: '#e0e0e8', fontFamily: "'Courier New', monospace", padding: 24
        }}>
          <div style={{ maxWidth: 900, width: '100%', border: '1px solid #2a2520', borderRadius: 16, padding: 18, background: 'rgba(10,10,15,0.9)' }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#ffaa22' }}>MyClaw3D crashed while rendering</div>
            <div style={{ fontSize: 12, color: '#cfc9c2', marginBottom: 10 }}>{msg}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {stack && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#6a6055', fontSize: 11, lineHeight: 1.5 }}>{stack}</pre>
              )}
              {comp && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#4a4540', fontSize: 11, lineHeight: 1.5 }}>{comp}</pre>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#6a6055' }}>
              Fix the error above and refresh. (This screen replaces the black screen.)
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ClawHQ />
  </ErrorBoundary>
);
