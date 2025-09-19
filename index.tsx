import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// If you have a global CSS file, you can import it here:
// import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element with id "root"');

// The ConfirmationModal component needs a DOM element to portal into.
// We create it here to ensure it exists before the app renders.
if (!document.getElementById('modal-root')) {
  const modalRoot = document.createElement('div');
  modalRoot.setAttribute('id', 'modal-root');
  document.body.appendChild(modalRoot);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
