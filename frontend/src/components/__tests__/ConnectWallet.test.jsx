import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectWallet } from '../ConnectWallet';

function setup(props = {}) {
  const connectWallet = props.connectWallet ?? vi.fn();
  const dismiss = props.dismiss ?? vi.fn();
  const utils = render(
    <ConnectWallet connectWallet={connectWallet} networkError={props.networkError} dismiss={dismiss} />
  );
  return { ...utils, connectWallet, dismiss };
}

describe('ConnectWallet', () => {
  it('renders app name', () => {
    setup();
    expect(screen.getByText('PedigreePal')).toBeInTheDocument();
  });

  it('renders Connect Wallet button', () => {
    setup();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('calls connectWallet when button is clicked', async () => {
    const { connectWallet } = setup();
    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(connectWallet).toHaveBeenCalledOnce();
  });

  it('does not show network error when networkError is falsy', () => {
    setup({ networkError: undefined });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows network error message when networkError is provided', () => {
    setup({ networkError: 'Wrong network' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Wrong network')).toBeInTheDocument();
  });

  it('calls dismiss when network error dismiss button is clicked', async () => {
    const { dismiss } = setup({ networkError: 'Wrong network' });
    const dismissBtn = screen.getByRole('button', { name: '' });
    await userEvent.click(dismissBtn);
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
