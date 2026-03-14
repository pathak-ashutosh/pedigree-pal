import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuccessToast } from '../SuccessToast';

describe('SuccessToast', () => {
  it('renders dog name in message', () => {
    render(<SuccessToast dog={{ name: 'Rex' }} onDone={vi.fn()} />);
    expect(screen.getByText(/rex is now on-chain/i)).toBeInTheDocument();
  });

  it('renders "Dog registered!" text', () => {
    render(<SuccessToast dog={{ name: 'Rex' }} onDone={vi.fn()} />);
    expect(screen.getByText(/dog registered/i)).toBeInTheDocument();
  });

  it('calls onDone when close button is clicked', async () => {
    const onDone = vi.fn();
    render(<SuccessToast dog={{ name: 'Rex' }} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone after 4 seconds via timer', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SuccessToast dog={{ name: 'Rex' }} onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(onDone).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('clears timer on unmount', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(<SuccessToast dog={{ name: 'Rex' }} onDone={onDone} />);
    unmount();
    vi.advanceTimersByTime(4000);
    expect(onDone).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
