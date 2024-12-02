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

const PumpCoordinator = ({ token, onJoin }) => (
  <div className="pump-coordinator">
    <h3>Pump Details: {token}</h3>
    <div className="pump-stats">
      <p>Participants: {Math.floor(Math.random() * 1000)}</p>
      <p>Target Time: {new Date(Date.now() + 3600000).toLocaleTimeString()}</p>
    </div>
    <button onClick={onJoin} className="join-button">Join Pump</button>
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
  const [isLoading, setIsLoading] = useState(false);
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
  onCreateToken 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = async () => {
    if (!window.connectWallet) return;
    setIsConnecting(true);
    try {
      await window.connectWallet();
    } catch (error) {
      console.error('Connection failed:', error);
    }
    setIsConnecting(false);
  };

  // When no wallet is connected
  if (!wallet) {
    return (
      <div className="profile-container">
        <div className="connect-buttons">
          <button 
            className="connect-wallet-button"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  // When wallet is connected
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
            <p className="wallet-address" title={wallet.account}>
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
                }}>Disconnect</button>
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

const WalletConnectOptions = ({ onConnect }) => {
  return (
    <div className="wallet-options">
      <button 
        className="wallet-option-button ledger"
        onClick={() => onConnect('ledger')}
      >
        <img 
          src="https://cryptologos.cc/logos/ledger-ledger-logo.png" 
          alt="Ledger" 
        />
        <span>Connect Ledger</span>
      </button>
    </div>
  );
};

const App = () => {
  const [client, setClient] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [xumm, setXumm] = useState(null);
  const [tokenPrice, setTokenPrice] = useState(null);
  const [activePumps, setActivePumps] = useState([]);
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

  // XRP burn address (BlackHole address)
  const BURN_ADDRESS = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";

  useEffect(() => {
    const initClient = async () => {
      const xrplClient = new Client('wss://s.altnet.rippletest.net:51233');
      await xrplClient.connect();
      setClient(xrplClient);
    };

    const initXaman = async () => {
      const xamanAuth = new XummPkce(
        process.env.REACT_APP_XAMAN_API_KEY,
        {
          implicit: true,
          apiSecret: process.env.REACT_APP_XAMAN_API_SECRET,
          redirectUrl: window.location.origin
        }
      );
      setXumm(xamanAuth);
    };

    const fetchPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
        const data = await response.json();
        setTokenPrice(data.ripple.usd);
      } catch (error) {
        console.error('Failed to fetch price:', error);
      }
    };

    initClient();
    initXaman();
    fetchPrice();
    WebApp.ready();
    
    // Refresh price every minute
    const priceInterval = setInterval(fetchPrice, 60000);
    
    // Update theme when Telegram theme changes
    const handleThemeChange = () => {
      setIsDarkMode(WebApp.colorScheme === 'dark');
    };
    
    window.Telegram.WebApp.onEvent('themeChanged', handleThemeChange);
    
    return () => {
      if (client) client.disconnect();
      clearInterval(priceInterval);
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

  const connectWallet = async (type = 'ledger') => {
    try {
      if (type === 'ledger') {
        try {
          // Request permission to access USB device
          const transport = await Transport.create();
          const xrp = new Xrp(transport);

          // Get public key and first address
          const { address, publicKey } = await xrp.getAddress("44'/144'/0'/0/0");

          // Get account info including balance
          const accountInfo = await client.request({
            command: 'account_info',
            account: address
          });
          
          const balance = accountInfo.result.account_data.Balance;
          const xrpBalance = (parseInt(balance) / 1000000).toFixed(2);

          setWallet({
            account: address,
            publicKey: publicKey,
            username: userProfile.username,
            bio: userProfile.bio,
            profileImage: userProfile.profileImage,
            balance: xrpBalance,
            type: 'ledger'
          });

          showNotification("Ledger connected successfully!");
          return;
        } catch (error) {
          console.error('Ledger connection failed:', error);
          if (error.message.includes('Unable to claim interface')) {
            showNotification("Please ensure your Ledger is connected and unlocked");
          } else if (error.message.includes('WebUSB')) {
            showNotification("WebUSB not supported. Please use Chrome or Edge browser");
          } else {
            showNotification("Failed to connect Ledger. Please try again.");
          }
          return;
        }
      }
      // ... rest of the existing wallet connection logic
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      showNotification("Failed to connect wallet. Please try again.");
    }
  };

  const joinPump = (token) => {
    WebApp.showAlert(`Joined pump for ${token}! Stay tuned for signals.`);
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

  const handleDisconnect = () => {
    setWallet(null);
    setUserProfile({
      username: '',
      bio: '',
      profileImage: null
    });
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
  }, []);

  return (
    <div className="app-container">
      <ThemeToggle isDark={isDarkMode} onToggle={toggleTheme} />
      <ProfileDropdown 
        wallet={{
          ...wallet,
          ...userProfile
        }}
        onDisconnect={handleDisconnect}
        onEditProfile={() => setShowProfileEditor(true)}
        onViewProfile={() => setShowProfileView(true)}
        onCreateToken={() => setShowTokenCreator(true)}
      />
      
      <div className="header-section">
        <div className="left-header">
          <div className="title-social">
            <h1>XRPump</h1>
            <div className="social-icons">
              <button 
                className="social-link"
                onClick={() => window.open('YOUR_URL_HERE', '_blank')}
                aria-label="Social Link"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
                </svg>
              </button>
              <button 
                className="social-link"
                onClick={() => window.open('YOUR_URL_HERE', '_blank')}
                aria-label="Social Link"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </button>
              <button 
                className="social-link"
                onClick={() => window.open('YOUR_URL_HERE', '_blank')}
                aria-label="Social Link"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                </svg>
              </button>
              <button 
                className="social-link"
                onClick={() => window.open('YOUR_URL_HERE', '_blank')}
                aria-label="Social Link"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

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
          client={client}
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
            tokensHeld: [], // Add your tokens data here
            tokensCreated: [] // Add your tokens data here
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
};

export default App; 