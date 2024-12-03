import React from 'react';

const WalletConnect = ({ onConnect, onBack }) => {
  return (
    <div className="wallet-connect-overlay">
      <div className="wallet-connect-page">
        <h1>Connect Wallet</h1>
        <div className="wallet-options">
          <button 
            className="wallet-option-button xaman"
            onClick={() => onConnect('xaman')}
          >
            <img 
              src="https://xumm.app/assets/icons/xumm-icon-dark.png" 
              alt="Xaman" 
            />
            <span>Connect with Xaman</span>
          </button>
        </div>
        <button 
          className="back-to-app"
          onClick={onBack}
        >
          ← Back to App
        </button>
      </div>
    </div>
  );
};

export default WalletConnect; 