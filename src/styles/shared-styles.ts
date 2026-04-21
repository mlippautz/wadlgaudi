import { css } from 'lit';

export const sharedStyles = css`
  .glass-panel {
    background: var(--surface-color);
    backdrop-filter: var(--backdrop-blur);
    -webkit-backdrop-filter: var(--backdrop-blur);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-glass);
  }

  .section-title {
    font-size: var(--font-size-section);
    color: var(--text-main);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-weight: 800;
    margin-bottom: 2rem;
    text-align: right;
    opacity: 0.9;
  }

  button {
    font-family: var(--font-family);
    background: var(--primary-color);
    color: #000;
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm);
    padding: 0.6rem 1.25rem;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 255, 255, 0.1);
  }

  button:not(.btn-icon):not(.skip-btn):not(.btn-danger):not(.btn-tertiary):hover {
    background: var(--primary-hover);
  }

  .btn-icon, .skip-btn, .btn-danger, .btn-tertiary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--surface-border);
    color: #fff !important;
  }

  .btn-icon:hover, .skip-btn:hover, .btn-danger:hover, .btn-tertiary:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.4);
  }

  button:active {
    transform: translateY(0);
  }

  input {
    font-family: var(--font-family);
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--surface-border);
    color: var(--text-main);
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius-sm);
    outline: none;
    width: 100%;
    transition: border-color 0.3s ease;
  }

  input:focus {
    border-color: var(--primary-color);
  }
`;
