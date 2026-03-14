import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoTokensMessage } from '../NoTokensMessage';

describe('NoTokensMessage', () => {
  it('renders prompt text', () => {
    render(<NoTokensMessage />);
    expect(screen.getByText(/what would you like to do/i)).toBeInTheDocument();
  });

  it('renders subtitle with register and look up mentions', () => {
    render(<NoTokensMessage />);
    expect(screen.getByText(/register a new dog/i)).toBeInTheDocument();
  });
});
