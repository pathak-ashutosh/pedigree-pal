import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaitingForTransactionMessage } from '../WaitingForTransactionMessage';

describe('WaitingForTransactionMessage', () => {
  it('renders "Mining transaction..." text', () => {
    render(<WaitingForTransactionMessage txHash="0xabc123" />);
    expect(screen.getByText(/mining transaction/i)).toBeInTheDocument();
  });

  it('renders the tx hash', () => {
    render(<WaitingForTransactionMessage txHash="0xabc123" />);
    expect(screen.getByText('0xabc123')).toBeInTheDocument();
  });

  it('has role=alert', () => {
    render(<WaitingForTransactionMessage txHash="0xabc" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
