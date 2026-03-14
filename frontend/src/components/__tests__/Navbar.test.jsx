import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '../Navbar';

function setup(props = {}) {
  const onDisconnect = props.onDisconnect ?? vi.fn();
  const utils = render(
    <Navbar selectedAddress={props.selectedAddress} onDisconnect={onDisconnect} />
  );
  return { ...utils, onDisconnect };
}

describe('Navbar', () => {
  it('renders app name', () => {
    setup();
    expect(screen.getByText('PedigreePal')).toBeInTheDocument();
  });

  it('shows truncated address when selectedAddress is provided', () => {
    setup({ selectedAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' });
    expect(screen.getByText('0xAbCd...Ef12')).toBeInTheDocument();
  });

  it('does not show address or disconnect button when no address', () => {
    setup({ selectedAddress: undefined });
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
  });

  it('shows Disconnect button when address is provided', () => {
    setup({ selectedAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' });
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('calls onDisconnect when Disconnect button is clicked', async () => {
    const { onDisconnect } = setup({
      selectedAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
    });
    await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it('truncates address to first 6 + last 4 chars', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    setup({ selectedAddress: addr });
    const expected = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
