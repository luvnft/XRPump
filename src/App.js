import React, { useEffect, useState, useRef, useCallback } from "react";
import WebApp from '@twa-dev/sdk';
import WalletConnect from './pages/WalletConnect';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

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

// Add this with other utility functions at the top
const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Add this utility function at the top with other utility functions
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showNotification("Address copied to clipboard!");
  } catch (err) {
    console.error('Failed to copy:', err);
    showNotification("Failed to copy address");
  }
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

const TokenCreator = ({ onClose, wallet, onSubmit }) => {
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
  navigate,
  connectWallet
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = () => {
    navigate('/connect');
  };

  // If no wallet is connected, just show connect button
  if (!wallet) {
    return (
      <div className="profile-container">
        <button 
          className="wallet-status-button"
          onClick={handleConnect}
        >
          <span className="wallet-info">
            <span className="username">Connect Wallet</span>
          </span>
        </button>
      </div>
    );
  }

  // If wallet is connected, show full dropdown functionality
  return (
    <div className="profile-container" ref={dropdownRef}>
      <div className="connected-buttons">
        <button 
          className="wallet-status-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <img 
            src={wallet.profileImage || generateDefaultAvatar(wallet.username)} 
            alt="Profile" 
            className="mini-profile-image"
          />
          <span className="wallet-info">
            <span className="username">{wallet.username || 'Anonymous'}</span>
            <span className="balance">{wallet.balance || '0'} XRP</span>
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-info">
            <img 
              src={wallet.profileImage || generateDefaultAvatar(wallet.username)} 
              alt="Profile" 
              className="profile-image"
            />
            <h3>{wallet.username || 'Anonymous'}</h3>
            <p className="profile-bio">{wallet.bio || 'No bio yet'}</p>
            <p 
              className="wallet-address" 
              title="Click to copy"
              onClick={() => copyToClipboard(wallet.account)}
            >
              {truncateAddress(wallet.account)}
            </p>
            <p className="wallet-balance">Balance: {wallet.balance || '0'} XRP</p>
          </div>

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
                <button onClick={onViewProfile}>View Profile</button>
                <button onClick={onEditProfile}>Edit Profile</button>
                <button onClick={() => {
                  onDisconnect();
                  setIsOpen(false);
                }}>Disconnect Wallet</button>
                <button onClick={() => setIsOpen(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
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
              <p 
                className="wallet-address" 
                title="Click to copy"
                onClick={() => copyToClipboard(wallet.account)}
              >
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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const App = () => {
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
  const [telegramId, setTelegramId] = useState(null);

  // Use the useNavigate hook from react-router-dom
  const navigate = useNavigate();

  // Initialize tokens and king token
  useEffect(() => {
    // Simulate fetching tokens
    const mockTokens = [
      {
        name: "XRPump Token",
        ticker: "PUMP",
        description: "The official XRPump token",
        marketCap: 5000000,
        price: 0.005,
        priceChange: 15.23,
        volume: 2500000,
        createdAt: Date.now() - 86400000,
        featured: true,
        image: 'path/to/pump-logo.png'
      },
      // ... other tokens
    ];
    setTokens(mockTokens);

    // Set King of the Hill token
    setKingToken({
      name: "XRPump Token",
      ticker: "PUMP",
      price: 0.005,
      volume: 2500000,
      marketCap: 5000000,
      priceChange: 15.23,
      image: 'path/to/pump-logo.png'
    });
  }, []);

  // Initialize Telegram ID
  useEffect(() => {
    if (window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      const userId = webApp.initDataUnsafe?.user?.id;
      if (userId) {
        setTelegramId(userId);
        console.log('Telegram ID set:', userId);
      }
    }
  }, []);

  // Add test connection function inside App component
  const testConnection = async () => {
    try {
      if (!telegramId) {
        showNotification("Please open app through Telegram bot");
        return;
      }

      const response = await fetch(`/api/test-connection/${telegramId}`);
      const data = await response.json();

      if (data.success) {
        setWallet({
          account: data.wallet.address,
          balance: data.wallet.balance,
          type: 'telegram'
        });
        showNotification("Connection successful!");
      } else {
        showNotification("No wallet found. Create one in the bot first!");
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      showNotification("Connection test failed. Please try again.");
    }
  };

  // Update WalletConnectWithTest component
  const WalletConnectWithTest = () => (
    <div className="wallet-connect-page">
      <div className="wallet-options">
        <button 
          onClick={() => setShowProfileEditor(true)}
          className="wallet-option-button"
        >
          Edit Profile
        </button>
        
        <button 
          onClick={() => setShowProfileView(true)}
          className="wallet-option-button"
        >
          View Profile
        </button>
        
        <button 
          onClick={handleDisconnect}
          className="wallet-option-button disconnect"
        >
          Disconnect
        </button>
        
        <button 
          onClick={handleBack}
          className="back-to-app"
        >
          Back to App
        </button>
      </div>

      {showProfileEditor && (
        <ProfileEditor
          wallet={{
            ...wallet,
            ...userProfile
          }}
          onSave={handleProfileSave}
          onClose={() => setShowProfileEditor(false)}
          onViewProfile={() => {
            setShowProfileEditor(false);
            setShowProfileView(true);
          }}
        />
      )}

      {showProfileView && (
        <ProfileView
          wallet={{
            ...wallet,
            ...userProfile,
            tokensHeld: [],
            tokensCreated: []
          }}
          onEditProfile={() => {
            setShowProfileView(false);
            setShowProfileEditor(true);
          }}
          onClose={() => setShowProfileView(false)}
        />
      )}
    </div>
  );

  // Update navigation
  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleBack = () => {
    handleNavigation('/');
  };

  // Add missing handler functions
  const connectWallet = useCallback(async () => {
    try {
      if (telegramId) {
        // Fetch wallet from bot's database
        const response = await fetch(`${API_URL}/api/telegram-wallet/${telegramId}`);
        const walletData = await response.json();
        
        if (walletData) {
          setWallet({
            account: walletData.address,
            balance: walletData.balance,
            type: 'telegram'
          });
          return;
        }
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      showNotification("Failed to connect wallet");
    }
  }, [telegramId]);

  const handleDisconnect = () => {
    setWallet(null);
    setUserProfile({
      username: '',
      bio: '',
      profileImage: null
    });
    showNotification("Wallet disconnected successfully");
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute(
      'data-theme',
      !isDarkMode ? 'dark' : 'light'
    );
  };

  const handleTrade = (token) => {
    showNotification(`Trading ${token.name} (${token.ticker})`);
    // Implement actual trading logic here
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

  const handleTokenCreation = async (tokenData) => {
    try {
      if (!wallet) {
        showNotification("Please connect a wallet first");
        return false;
      }

      if (wallet.type === 'telegram') {
        const response = await fetch(`${API_URL}/api/telegram-wallet/${telegramId}/create-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(tokenData)
        });

        const result = await response.json();
        if (result.success) {
          showNotification("Token created successfully!");
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Token creation failed:', error);
      showNotification("Failed to create token. Please try again.");
      return false;
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

  // Initialize Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      
      // Enable debugging
      webApp.enableClosingConfirmation();
      webApp.expand();
      
      // Get user data
      const initData = webApp.initData;
      const initDataUnsafe = webApp.initDataUnsafe;
      
      console.log('Telegram WebApp initialized:', {
        initData,
        initDataUnsafe,
        colorScheme: webApp.colorScheme,
        themeParams: webApp.themeParams
      });

      // Set theme based on Telegram theme
      setIsDarkMode(webApp.colorScheme === 'dark');
      
      // Set user ID if available
      if (initDataUnsafe?.user?.id) {
        setTelegramId(initDataUnsafe.user.id);
      }

      webApp.ready();
    } else {
      console.error('Telegram WebApp not available');
    }
  }, []);

  const MainContent = () => (
    <>
      <header>
        <div className="header-content">
          <div className="left-header">
            <div className="title-social">
              <h1>XRPump</h1>
              <div className="social-icons">
                <button 
                  className="social-link"
                  onClick={() => window.open('https://twitter.com/XRPump', '_blank')}
                  aria-label="Twitter"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
                  </svg>
                </button>
                <button 
                  className="social-link"
                  onClick={() => window.open('https://t.me/XRPump', '_blank')}
                  aria-label="Telegram"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </button>
                <button 
                  className="social-link"
                  onClick={() => window.open('https://discord.gg/XRPump', '_blank')}
                  aria-label="Discord"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="right-header">
            <ProfileDropdown 
              wallet={wallet}
              onDisconnect={handleDisconnect}
              onEditProfile={() => setShowProfileEditor(true)}
              onViewProfile={() => setShowProfileView(true)}
              navigate={handleNavigation}
              connectWallet={connectWallet}
            />
            <ThemeToggle isDark={isDarkMode} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      {kingToken && (
        <KingOfTheHill 
          token={kingToken}
          onTrade={handleTrade}
        />
      )}

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

      {showTokenCreator && (
        <TokenCreator 
          onClose={() => setShowTokenCreator(false)}
          wallet={wallet}
          onSubmit={handleTokenCreation}
        />
      )}

      {showProfileEditor && (
        <ProfileEditor
          wallet={{
            ...wallet,
            ...userProfile
          }}
          onSave={handleProfileSave}
          onClose={() => setShowProfileEditor(false)}
          onViewProfile={() => {
            setShowProfileEditor(false);
            setShowProfileView(true);
          }}
        />
      )}

      {showProfileView && (
        <ProfileView
          wallet={{
            ...wallet,
            ...userProfile,
            tokensHeld: [],
            tokensCreated: []
          }}
          onEditProfile={() => {
            setShowProfileView(false);
            setShowProfileEditor(true);
          }}
          onClose={() => setShowProfileView(false)}
        />
      )}
    </>
  );

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<MainContent />} />
        <Route path="/connect" element={<WalletConnectWithTest />} />
      </Routes>
    </div>
  );
};

// Add error boundary component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h2>Something went wrong</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap App with ErrorBoundary
const AppWrapper = () => {
  return (
    <Router>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Router>
  );
};

export default AppWrapper; 