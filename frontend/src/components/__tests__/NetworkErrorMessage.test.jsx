import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkErrorMessage } from '../NetworkErrorMessage';

describe('NetworkErrorMessage', () => {
  it('renders the error message', () => {
    render(<NetworkErrorMessage message="Wrong network" dismiss={vi.fn()} />);
    expect(screen.getByText('Wrong network')).toBeInTheDocument();
  });

  it('has role=alert', () => {
    render(<NetworkErrorMessage message="Error" dismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls dismiss when close button is clicked', async () => {
    const dismiss = vi.fn();
    render(<NetworkErrorMessage message="Error" dismiss={dismiss} />);
    await userEvent.click(screen.getByRole('button'));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
