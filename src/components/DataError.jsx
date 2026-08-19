import { useState } from 'react';
import { useStore } from '../store';

/**
 * Shows what is wrong with public/data/*.json when a fetched file fails
 * validation. The site keeps running on the last good (bundled) copy — this
 * banner just tells you why your edit did not show up.
 */
export default function DataError() {
  const errors = useStore((s) => s.dataErrors);
  const [hidden, setHidden] = useState(false);

  if (!errors.length || hidden) return null;

  return (
    <div className="dataerr glass" role="alert">
      <div className="dataerr__head">
        <span className="dataerr__dot" />
        <b>Content file problem</b>
        <button className="dataerr__x" onClick={() => setHidden(true)} aria-label="Dismiss">
          ×
        </button>
      </div>
      <ul className="dataerr__list">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <p className="dataerr__note">Showing the last working content until this is fixed.</p>
    </div>
  );
}
