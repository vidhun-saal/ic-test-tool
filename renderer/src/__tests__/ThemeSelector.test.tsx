import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';

// Mock localStorage and matchMedia
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const matchMediaMock = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
});

describe('ThemeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('renders with default system theme selected', () => {
    render(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    );

    const select = screen.getByRole('combobox', { name: /theme/i });
    expect(select).toHaveValue('system');
  });

  it('displays all theme options', () => {
    render(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    );

    expect(screen.getByRole('option', { name: 'System' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument();
  });

  it('changes theme when option is selected', () => {
    render(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    );

    const select = screen.getByRole('combobox', { name: /theme/i });
    
    fireEvent.change(select, { target: { value: 'light' } });
    expect(select).toHaveValue('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');

    fireEvent.change(select, { target: { value: 'dark' } });
    expect(select).toHaveValue('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('applies custom className', () => {
    render(
      <ThemeProvider>
        <ThemeSelector className="custom-class" />
      </ThemeProvider>
    );

    const wrapper = screen.getByRole('combobox', { name: /theme/i }).parentElement;
    expect(wrapper).toHaveClass('custom-class');
  });
});
