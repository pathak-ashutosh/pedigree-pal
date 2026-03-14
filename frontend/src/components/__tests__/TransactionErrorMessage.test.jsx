import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionErrorMessage } from '../TransactionErrorMessage';

describe('TransactionErrorMessage', () => {
  it('renders "Transaction failed" heading', () => {
    render(<TransactionErrorMessage message="Out of gas" dismiss={vi.fn()} />);
    expect(screen.getByText(/transaction failed/i)).toBeInTheDocument();
  });

  it('renders first 100 chars of message', () => {
    const msg = 'A'.repeat(150);
    render(<TransactionErrorMessage message={msg} dismiss={vi.fn()} />);
    expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
  });

  it('has role=alert', () => {
    render(<TransactionErrorMessage message="Error" dismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls dismiss when close button is clicked', async () => {
    const dismiss = vi.fn();
    render(<TransactionErrorMessage message="Error" dismiss={dismiss} />);
    await userEvent.click(screen.getByRole('button'));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
