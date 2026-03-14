import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoWalletDetected } from '../NoWalletDetected';

describe('NoWalletDetected', () => {
  it('renders "No Wallet Found" heading', () => {
    render(<NoWalletDetected />);
    expect(screen.getByRole('heading', { name: /no wallet found/i })).toBeInTheDocument();
  });

  it('renders MetaMask link', () => {
    render(<NoWalletDetected />);
    expect(screen.getByRole('link', { name: /metamask/i })).toBeInTheDocument();
  });

  it('renders Coinbase Wallet link', () => {
    render(<NoWalletDetected />);
    expect(screen.getByRole('link', { name: /coinbase wallet/i })).toBeInTheDocument();
  });

  it('links open in new tab', () => {
    render(<NoWalletDetected />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
