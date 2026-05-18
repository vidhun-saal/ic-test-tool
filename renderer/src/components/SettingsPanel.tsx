import React, { useState } from 'react';
import { ThemeSelector } from './ThemeSelector';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button 
            className="settings-close-button" 
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <h3>Appearance</h3>
            <ThemeSelector />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsButtonProps {
  onClick: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button 
      className="settings-button" 
      onClick={onClick}
      aria-label="Open settings"
      title="Settings"
    >
      ⚙️
    </button>
  );
}