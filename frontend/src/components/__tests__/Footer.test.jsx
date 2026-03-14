import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';

describe('Footer', () => {
  it('renders app name', () => {
    render(<Footer />);
    expect(screen.getByText('PedigreePal')).toBeInTheDocument();
  });

  it('renders Hardhat Local Network label', () => {
    render(<Footer />);
    expect(screen.getByText('Hardhat Local Network')).toBeInTheDocument();
  });

  it('shows truncated contract address when provided', () => {
    const addr = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    render(<Footer contractAddr={addr} />);
    const expected = `Contract: ${addr.slice(0, 8)}...${addr.slice(-6)}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('does not show contract address when not provided', () => {
    render(<Footer />);
    expect(screen.queryByText(/contract:/i)).not.toBeInTheDocument();
  });
});
