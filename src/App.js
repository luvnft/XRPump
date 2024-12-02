import React, { useEffect, useState, useRef } from "react";
import { Client } from 'xrpl';
import WebApp from '@twa-dev/sdk';
import { XummPkce } from 'xumm-oauth2-pkce';
import Transport from "@ledgerhq/hw-transport-webusb";
import Xrp from "@ledgerhq/hw-app-xrp";

// Add this utility function at the top of the file
const formatTimeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  } else {
    return 'Just now';
  }
};

// Add this helper function at the top of your file
const showNotification = (message) => {
  try {
    WebApp.showAlert(message);
  } catch (error) {
    // Fallback for local development
    console.log('Notification:', message);
    // You could also use a custom alert or notification system here
    alert(message);
  }
};

// Add this function at the top of the file with other utility functions
const generateDefaultAvatar = (username = '') => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 200;

  // Create gradient background
  const gradient = context.createLinearGradient(0, 0, 200, 200);
  gradient.addColorStop(0, '#00ffff');
  gradient.addColorStop(1, '#0070f3');
  
  // Fill background
  context.fillStyle = gradient;
  context.fillRect(0, 0, 200, 200);

  // Add initials or default icon
  context.fillStyle = 'white';
  context.font = 'bold 80px Righteous';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  const initials = username
    ? username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '';
  
  context.fillText(initials, 100, 100);

  return canvas.toDataURL('image/png');
};

// New components
const KingOfTheHill = ({ token, onTrade }) => (
  <div className="king-of-hill">
    <h2 className="king-title-header">
      <span className="crown">👑</span>
      King of the Hill
      <span className="crown">👑</span>
    </h2>
    <div className="king-card">
      <div className="king-header">
        <img 
          src={token.image || 'default-token.png'} 
          alt={token.name} 
          className="king-image"
        />
        <div className="king-title">
          <h3>{token.name} ({token.ticker})</h3>
          <p className="volume-badge">Volume: ${token.volume.toLocaleString()}</p>
        </div>
      </div>
      <div className="king-stats">
        <div className="stat">
          <label>Price</label>
          <value>${token.price.toFixed(6)}</value>
        </div>
        <div className="stat">
          <label>24h Change</label>
          <value className={token.priceChange >= 0 ? 'positive' : 'negative'}>
            {token.priceChange > 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
          </value>
        </div>
        <div className="stat">
          <label>Market Cap</label>
          <value>${token.marketCap.toLocaleString()}</value>
        </div>
      </div>
      <button onClick={() => onTrade(token)} className="trade-button king-trade">
        Trade
      </button>
    </div>
  </div>
);

const TokenCreator = ({ onClose, wallet, client, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    description: '',
    image: null,
    totalSupply: '1000000000',
    burnAmount: '0',
    twitter: '',
    telegram: '',
    website: '',
  });
  const [isLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [showTokenDetails, setShowTokenDetails] = useState(true);
  const [showTokenomics, setShowTokenomics] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (limit to 2MB)
      if (file.size > 2 * 1024 * 1024) {
        WebApp.showAlert("Image size must be less than 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // Create an image element to get dimensions
        const img = new Image();
        img.onload = () => {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions (max 200x200)
          const maxSize = 200;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw resized image
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed base64
          const compressedImage = canvas.toDataURL('image/jpeg', 0.8);
          setFormData(prev => ({ ...prev, image: compressedImage }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirm = async (xrpAmount) => {
    try {
      const result = await onSubmit({ ...formData, initialLiquidity: xrpAmount });
      if (result) {
        onClose();
      }
    } catch (error) {
      console.error('Token creation failed:', error);
      showNotification("Failed to create token. Please try again.");
    }
  };

  return (
    <div className="token-creator-overlay">
      <div className="token-creator" ref={modalRef}>
        <h2>Create New Token</h2>
        <form onSubmit={handleSubmit}>
          <div className="token-details-section">
            <button 
              type="button" 
              className="toggle-details-button"
              onClick={() => setShowTokenDetails(!showTokenDetails)}
            >
              {showTokenDetails ? '− ' : '+ '}Token Details
            </button>
            
            {showTokenDetails && (
              <div className="token-details-fields">
                <div className="form-group">
                  <label>
                    Token Name
                    <span className={`required-dot ${formData.name ? 'filled' : ''}`}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Ticker Symbol
                    <span className={`required-dot ${formData.ticker ? 'filled' : ''}`}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={e => setFormData(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Description
                    <span className={`required-dot ${formData.description ? 'filled' : ''}`}>*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => {
                      if (e.target.value.length <= 100) {
                        setFormData(prev => ({ ...prev, description: e.target.value }))
                      }
                    }}
                    maxLength={100}
                    rows={2}
                    className="fixed-textarea"
                    required
                  />
                  <div className="character-count">
                    {formData.description.length}/100
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Token Image
                    <span className={`required-dot ${formData.image ? 'filled' : ''}`}>*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="tokenomics-section">
            <button 
              type="button" 
              className="toggle-tokenomics-button"
              onClick={() => setShowTokenomics(!showTokenomics)}
            >
              {showTokenomics ? '− ' : '+ '}Tokenomics
            </button>
            
            {showTokenomics && (
              <div className="tokenomics-fields">
                <div className="form-group">
                  <label>Total Supply</label>
                  <input
                    type="number"
                    value={formData.totalSupply}
                    onChange={e => setFormData(prev => ({ ...prev, totalSupply: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Burn Amount (%)</label>
                  <input
                    type="number"
                    value={formData.burnAmount}
                    onChange={e => setFormData(prev => ({ ...prev, burnAmount: e.target.value }))}
                    min="0"
                    max="100"
                    placeholder="0-100"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="social-links-section">
            <button 
              type="button" 
              className="toggle-social-button"
              onClick={() => setShowSocialLinks(!showSocialLinks)}
            >
              {showSocialLinks ? '− ' : '+ '}Social Links
            </button>
            
            {showSocialLinks && (
              <div className="social-links-fields">
                <div className="form-group">
                  <label>Twitter URL</label>
                  <input
                    type="url"
                    value={formData.twitter}
                    onChange={e => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                    placeholder="https://twitter.com/..."
                  />
                </div>

                <div className="form-group">
                  <label>Telegram URL</label>
                  <input
                    type="url"
                    value={formData.telegram}
                    onChange={e => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                    placeholder="https://t.me/..."
                  />
                </div>

                <div className="form-group">
                  <label>Website URL</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="button-group">
            <button type="button" onClick={onClose} className="cancel-button">Cancel</button>
            <button type="submit" className="create-button" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Next'}
            </button>
          </div>
        </form>
      </div>
      {showConfirm && (
        <TokenCreationConfirm
          tokenData={formData}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

// Add ThemeToggle component
const ThemeToggle = ({ isDark, onToggle }) => (
  <button 
    onClick={onToggle} 
    className={`theme-toggle ${isDark ? 'dark' : 'light'}`}
    aria-label="Toggle theme"
  >
    {isDark ? '☀' : '🌙'}
  </button>
);

// New TokenList component
const TokenList = ({ tokens, sortBy, onSortChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [, setTimeUpdate] = useState(0);

  // Filter tokens based on search term
  const filteredTokens = tokens.filter(token => 
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUpdate(prev => prev + 1);
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="token-list">
      <div className="token-list-header">
        <div className="token-list-controls">
          <select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select"
          >
            <option value="featured">Featured Tokens</option>
            <option value="marketCap">Market Cap (High to Low)</option>
            <option value="new">Newly Created</option>
            <option value="volume">Volume (High to Low)</option>
          </select>
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="tokens-grid">
        {filteredTokens.map((token, index) => (
          <div key={index} className="token-card">
            <img 
              src={token.image || 'default-token.png'} 
              alt={token.name}
              className="token-image"
            />
            <h3>{token.name} ({token.ticker})</h3>
            <p className="token-description">{token.description}</p>
            <div className="token-stats">
              <div>
                <label>Market Cap</label>
                <value>${token.marketCap?.toLocaleString()}</value>
              </div>
              <div>
                <label>Price</label>
                <value>${token.price?.toFixed(6)}</value>
              </div>
              <div>
                <label>24h Change</label>
                <span className={`price-change ${token.priceChange >= 0 ? 'positive' : 'negative'}`}>
                  {token.priceChange > 0 ? '+' : ''}{token.priceChange?.toFixed(2)}%
                </span>
              </div>
              <div className="creation-time">
                <label>Created</label>
                <span>{formatTimeAgo(token.createdAt)}</span>
              </div>
            </div>
            <button className="trade-button">Trade</button>
          </div>
        ))}
        {filteredTokens.length === 0 && (
          <div className="no-results">
            No tokens found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileDropdown = ({ 
  wallet, 
  onDisconnect, 
  onEditProfile, 
  onViewProfile,
  onCreateToken,
  connectWallet
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const dropdownRef = useRef(null);

  return (
    <div className="profile-container" ref={dropdownRef}>
      <button 
        className="wallet-status-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="wallet-info">
          <span className="username">Settings</span>
        </span>
      </button>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-actions-section">
            <button 
              type="button" 
              className="toggle-actions-button"
              onClick={() => setShowActions(!showActions)}
            >
              {showActions ? '− ' : '+ '}Settings
            </button>
            
            {showActions && (
              <div className="profile-actions-fields">
                <button onClick={() => setIsOpen(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ConnectWallet = ({ onConnect, isConnecting }) => {
  return (
    <div className="connect-wallet-container">
      <button 
        onClick={() => onConnect('ledger')}
        disabled={isConnecting}
        className="connect-wallet-button"
      >
        {isConnecting ? 'Connecting...' : 'Connect Ledger'}
      </button>
    </div>
  );
};

const ProfileEditor = ({ wallet, onSave, onClose, onViewProfile }) => {
  const [formData, setFormData] = useState({
    username: wallet.username || '',
    bio: wallet.bio || '',
    profileImage: wallet.profileImage || generateDefaultAvatar(wallet.username)
  });

  // Create a hidden file input ref
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        WebApp.showAlert("Image size must be less than 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const maxSize = 200;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedImage = canvas.toDataURL('image/jpeg', 0.8);
          setFormData(prev => ({ ...prev, profileImage: compressedImage }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAvatar = () => {
    const newAvatar = generateDefaultAvatar(formData.username);
    setFormData(prev => ({ ...prev, profileImage: newAvatar }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="profile-editor-overlay">
      <div className="profile-editor">
        <h2>Edit Profile</h2>
        <form onSubmit={handleSubmit}>
          <div className="profile-image-container">
            <img 
              src={formData.profileImage || generateDefaultAvatar()} 
              alt="Profile Preview" 
              className="profile-preview"
            />
            <div className="image-buttons">
              <button 
                type="button"
                className="camera-button"
                onClick={() => fileInputRef.current.click()}
                title="Upload Image"
              >
                📷
              </button>
              <button
                type="button"
                className="generate-button"
                onClick={handleGenerateAvatar}
                title="Generate Avatar"
              >
                🎲
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                username: e.target.value 
              }))}
              maxLength={20}
              required
            />
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={formData.bio}
              onChange={e => {
                if (e.target.value.length <= 100) {
                  setFormData(prev => ({ 
                    ...prev, 
                    bio: e.target.value 
                  }));
                }
              }}
              maxLength={100}
              rows={2}
              placeholder="Tell us about yourself..."
            />
            <div className="character-count">
              {formData.bio.length}/100
            </div>
          </div>

          <div className="button-group">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="button" onClick={onViewProfile} className="view-profile-button">
              View Profile
            </button>
            <button type="submit" className="save-button">
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProfileView = ({ wallet, onEditProfile, onClose }) => {
  const [tokensExpanded, setTokensExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('held'); // 'held' or 'created'

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="profile-view-overlay">
      <div className="profile-view">
        <div className="profile-view-header">
          <h2>Profile</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="profile-view-content">
          <div className="profile-view-info">
            <img 
              src={wallet.profileImage || generateDefaultAvatar(wallet.username)} 
              alt="Profile" 
              className="profile-view-image"
            />
            <div className="profile-info-text">
              <h3>{wallet.username || 'Anonymous'}</h3>
              <p className="profile-view-bio">{wallet.bio || 'No bio yet'}</p>
              <p className="wallet-address" title={wallet.account}>
                {truncateAddress(wallet.account)}
              </p>
            </div>
            <button onClick={onEditProfile} className="edit-profile-button">
              Edit Profile
            </button>
          </div>

          <div className="tokens-section">
            <div 
              className="tokens-section-header"
              onClick={() => setTokensExpanded(!tokensExpanded)}
            >
              <h3>Your Tokens</h3>
              <span className={`toggle-icon ${tokensExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            <div className={`tokens-section-content ${tokensExpanded ? 'expanded' : ''}`}>
              <div className="tokens-tabs">
                <button 
                  className={`tab-button ${activeTab === 'held' ? 'active' : ''}`}
                  onClick={() => setActiveTab('held')}
                >
                  Tokens Held
                </button>
                <button 
                  className={`tab-button ${activeTab === 'created' ? 'active' : ''}`}
                  onClick={() => setActiveTab('created')}
                >
                  Tokens Created
                </button>
              </div>

              <div className="tokens-list">
                {activeTab === 'held' ? (
                  wallet.tokensHeld?.map((token, index) => (
                    <div key={index} className="token-mini-card">
                      <img src={token.image || generateDefaultAvatar(token.creatorName)} alt={token.creatorName} />
                      <div className="token-info">
                        <h4>{token.name}</h4>
                        <p>Balance: {token.balance}</p>
                      </div>
                    </div>
                  )) || <p className="no-tokens">No tokens held</p>
                ) : (
                  wallet.tokensCreated?.map((token, index) => (
                    <div key={index} className="token-mini-card">
                      <img src={token.image || generateDefaultAvatar(token.creatorName)} alt={token.creatorName} />
                      <div className="token-info">
                        <h4>{token.name}</h4>
                        <p>Created: {formatTimeAgo(token.createdAt)}</p>
                      </div>
                    </div>
                  )) || <p className="no-tokens">No tokens created</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add this new component
const TokenCreationConfirm = ({ tokenData, onConfirm, onCancel }) => {
  const [xrpAmount, setXrpAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleConfirm = async () => {
    if (!xrpAmount || parseFloat(xrpAmount) <= 0) {
      showNotification("Please enter a valid XRP amount");
      return;
    }

    // Check if wallet is connected
    if (!window.connectWallet) {
      showNotification("Something went wrong. Please try again.");
      return;
    }

    if (!window.wallet) {
      showNotification("Please connect your wallet to create a token");
      try {
        await window.connectWallet();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        return;
      }
    }

    setIsProcessing(true);
    try {
      await onConfirm(parseFloat(xrpAmount));
    } catch (error) {
      console.error('Token creation failed:', error);
      showNotification("Failed to create token. Please try again.");
    }
    setIsProcessing(false);
  };

  return (
    <div className="token-confirm-overlay">
      <div className="token-confirm-modal" ref={modalRef}>
        <h3>Create Token</h3>
        <div className="token-summary">
          <p><strong>Name:</strong> {tokenData.name}</p>
          <p><strong>Symbol:</strong> {tokenData.ticker}</p>
          <p><strong>Total Supply:</strong> {tokenData.totalSupply}</p>
        </div>
        
        <div className="xrp-input-section">
          <label>Initial Liquidity (XRP)</label>
          <div className="xrp-input-wrapper">
            <input
              type="number"
              value={xrpAmount}
              onChange={(e) => setXrpAmount(e.target.value)}
              placeholder="Enter XRP amount"
              min="0"
              step="0.1"
              required
            />
            <span className="xrp-symbol">XRP</span>
          </div>
          <p className="input-note">
            This amount will be used to create the initial liquidity pool
          </p>
        </div>

        <div className="fee-summary">
          <p>Creation Fee: 2 XRP</p>
          <p>Initial Liquidity: {xrpAmount || '0'} XRP</p>
          <p className="total">Total: {(parseFloat(xrpAmount || 0) + 2).toFixed(2)} XRP</p>
        </div>

        <div className="confirm-actions">
          <button 
            className="cancel-button" 
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button 
            className="confirm-button" 
            onClick={handleConfirm}
            disabled={isProcessing || !xrpAmount}
          >
            {isProcessing ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [client, setClient] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [showTokenCreator, setShowTokenCreator] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [tokens, setTokens] = useState([]);
  const [sortBy, setSortBy] = useState('featured');
  const [kingToken, setKingToken] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [userProfile, setUserProfile] = useState({
    username: '',
    bio: '',
    profileImage: null
  });
  const [showProfileView, setShowProfileView] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // XRP burn address (BlackHole address)
  const BURN_ADDRESS = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";

  useEffect(() => {
    const initClient = async () => {
      const xrplClient = new Client('wss://s.altnet.rippletest.net:51233');
      await xrplClient.connect();
      setClient(xrplClient);
    };

    initClient();
    WebApp.ready();
    
    // Update theme when Telegram theme changes
    const handleThemeChange = () => {
      setIsDarkMode(WebApp.colorScheme === 'dark');
    };
    
    window.Telegram.WebApp.onEvent('themeChanged', handleThemeChange);
    
    return () => {
      if (client) client.disconnect();
      window.Telegram.WebApp.offEvent('themeChanged', handleThemeChange);
    };
  }, []);

  useEffect(() => {
    // Simulate fetching tokens - replace with actual API call
    const fetchTokens = async () => {
      // Example tokens with varied data
      const mockTokens = [
        {
          name: "Sample Token",
          ticker: "SMPL",
          description: "A sample token for demonstration",
          marketCap: 1000000,
          price: 0.001,
          priceChange: 5.23,
          createdAt: Date.now() - 86400000,
          featured: true
        },
        {
          name: "High Volume Token",
          ticker: "HVT",
          description: "Token with highest trading volume",
          marketCap: 2000000,
          price: 0.002,
          priceChange: -2.45,
          createdAt: Date.now() - 172800000,
          featured: true
        },
        {
          name: "New Token",
          ticker: "NEW",
          description: "Recently created token",
          marketCap: 500000,
          price: 0.0005,
          priceChange: 12.34,
          createdAt: Date.now() - 3600000,
          featured: false
        },
        {
          name: "Small Cap Token",
          ticker: "SCT",
          description: "Token with lower market cap",
          marketCap: 100000,
          price: 0.0001,
          priceChange: -8.67,
          createdAt: Date.now() - 259200000,
          featured: false
        }
      ];
      setTokens(mockTokens);
    };

    fetchTokens();
  }, []);

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      // Use Telegram WebApp to get wallet info
      if (!WebApp.initData) {
        showNotification("Please open this app through Telegram");
        return;
      }

      try {
        // Get the user's wallet address from Telegram WebApp
        const userWallet = await WebApp.MainButton.getData();
        
        if (!userWallet) {
          showNotification("Please connect your wallet in Telegram first");
          return;
        }

        // Get account info
        const accountInfo = await client.request({
          command: 'account_info',
          account: userWallet.address
        });
        
        const balance = accountInfo.result.account_data.Balance;
        const xrpBalance = (parseInt(balance) / 1000000).toFixed(2);

        setWallet({
          account: userWallet.address,
          publicKey: userWallet.publicKey,
          username: userProfile.username,
          bio: userProfile.bio,
          profileImage: userProfile.profileImage,
          balance: xrpBalance,
          type: 'telegram'
        });

        showNotification("Wallet connected successfully!");
      } catch (error) {
        showNotification("Please ensure your wallet is connected in Telegram");
        throw error;
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      showNotification("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.style.setProperty(
      '--bg-color', 
      !isDarkMode ? '#1f1f1f' : '#ffffff'
    );
    document.documentElement.style.setProperty(
      '--text-color', 
      !isDarkMode ? '#ffffff' : '#000000'
    );
    document.documentElement.setAttribute('data-theme', !isDarkMode ? 'dark' : 'light');
  };

  // Update TokenCreator to use burn address
  const handleTokenCreation = async (tokenData) => {
    try {
      // Create token transaction
      const createTokenTx = {
        TransactionType: "Payment",
        Account: wallet.account,
        Destination: BURN_ADDRESS,
        Amount: "2000000", // 2 XRP in drops
        Memos: [{
          Memo: {
            MemoType: Buffer.from("Token Creation", "utf8").toString("hex"),
            MemoData: Buffer.from(JSON.stringify({
              name: tokenData.name,
              symbol: tokenData.ticker,
              description: tokenData.description,
              totalSupply: tokenData.totalSupply,
              burnPercent: tokenData.burnAmount
            }), "utf8").toString("hex")
          }
        }]
      };

      const prepared = await client.autofill(createTokenTx);
      const signed = await client.sign(prepared);
      const result = await client.submit(signed);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        showNotification("Token created successfully!");
        return true;
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error('Token creation failed:', error);
      showNotification("Failed to create token. Please try again.");
      return false;
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    let sortedTokens = [...tokens];
    
    switch(newSort) {
      case 'marketCap':
        sortedTokens.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case 'new':
        sortedTokens.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'featured':
        sortedTokens.sort((a, b) => b.featured - a.featured);
        break;
      case 'volume':
        sortedTokens.sort((a, b) => b.volume - a.volume);
        break;
      default:
        break;
    }
    
    setTokens(sortedTokens);
  };

  useEffect(() => {
    // Set initial theme
    document.documentElement.style.setProperty('--bg-color', '#1f1f1f');
    document.documentElement.style.setProperty('--text-color', '#ffffff');
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    const updateKingOfHill = async () => {
      try {
        // In a real implementation, this would fetch from your API
        // For now, we'll simulate with the highest volume token
        const highestVolumeToken = tokens.reduce((prev, current) => {
          return (prev.volume > current.volume) ? prev : current;
        }, { volume: 0 });

        setKingToken({
          name: highestVolumeToken.name || "Sample Token",
          ticker: highestVolumeToken.ticker || "SMPL",
          price: highestVolumeToken.price || 0.001,
          volume: highestVolumeToken.volume || 1000000,
          marketCap: highestVolumeToken.marketCap || 5000000,
          priceChange: Math.random() * 20 - 10, // Simulate price change
          image: highestVolumeToken.image
        });
      } catch (error) {
        console.error('Failed to update King of the Hill:', error);
      }
    };

    // Initial update
    updateKingOfHill();

    // Update every 5 minutes
    const interval = setInterval(updateKingOfHill, 300000);

    return () => clearInterval(interval);
  }, [tokens]);

  // Add trading handler
  const handleTrade = (token) => {
    showNotification(`Trading ${token.name} (${token.ticker})`);
    // Implement actual trading logic here
  };

  const handleDisconnect = async () => {
    try {
      // For Telegram wallet, we just clear the local state
      setWallet(null);
      setUserProfile({
        username: '',
        bio: '',
        profileImage: null
      });
      showNotification("Wallet disconnected successfully");
    } catch (error) {
      console.error('Failed to disconnect:', error);
      showNotification("Failed to disconnect wallet properly");
      // Still clear the states even if there's an error
      setWallet(null);
      setUserProfile({
        username: '',
        bio: '',
        profileImage: null
      });
    }
  };

  const handleProfileSave = (profileData) => {
    setUserProfile(profileData);
    setWallet(prevWallet => ({
      ...prevWallet,
      username: profileData.username,
      bio: profileData.bio,
      profileImage: profileData.profileImage
    }));
    setShowProfileEditor(false);
    showNotification("Profile updated successfully!");
  };

  useEffect(() => {
    // Make connectWallet available globally
    window.connectWallet = connectWallet;
    
    return () => {
      delete window.connectWallet;
    };
  }, [connectWallet]);

  useEffect(() => {
    // Initialize Telegram WebApp
    WebApp.ready();
    
    // Enable closing confirmation if needed
    WebApp.enableClosingConfirmation();

    // Handle main button clicks
    WebApp.MainButton.onClick(() => {
      // Handle main button actions
    });

    return () => {
      // Cleanup
      WebApp.MainButton.offClick();
    };
  }, []);

  return (
    <div className="app">
      {!wallet ? (
        <ConnectWallet 
          onConnect={connectWallet}
          isConnecting={isConnecting}
        />
      ) : (
        <>
          <ProfileDropdown 
            wallet={wallet}
            onDisconnect={handleDisconnect}
            onEditProfile={() => setShowProfileEditor(true)}
            onViewProfile={() => setShowProfileView(true)}
            onCreateToken={() => setShowTokenCreator(true)}
          />
          <div className="token-section">
            <h2>
              <span className="spinning-token">🪙</span>
              Token Directory
              <span className="spinning-token">🪙</span>
            </h2>
            <button 
              onClick={() => setShowTokenCreator(true)} 
              className="create-token-button"
            >
              Create New Token
            </button>
            <TokenList 
              tokens={tokens}
              sortBy={sortBy}
              onSortChange={handleSortChange}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default App; 