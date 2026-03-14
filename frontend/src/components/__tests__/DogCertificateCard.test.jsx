import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DogCertificateCard } from '../DogCertificateCard';

const defaultProps = {
  dogId: '3',
  name: 'Rex',
  breed: 'Labrador',
  sex: 'M',
  age: '3',
  mother: '0',
  father: '1',
  owner: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
};

function setup(props = {}) {
  return render(<DogCertificateCard {...defaultProps} {...props} />);
}

describe('DogCertificateCard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dog name and ID', () => {
    setup();
    expect(screen.getByText('Rex')).toBeInTheDocument();
    expect(screen.getAllByText(/dog #3/i).length).toBeGreaterThan(0);
  });

  it('renders breed and age', () => {
    setup();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
    expect(screen.getByText(/3 years/i)).toBeInTheDocument();
  });

  it('renders "1 year" (singular) for age=1', () => {
    setup({ age: '1' });
    expect(screen.getByText(/1 year$/)).toBeInTheDocument();
  });

  it('renders "2 years" (plural) for age=2', () => {
    setup({ age: '2' });
    expect(screen.getByText(/2 years/i)).toBeInTheDocument();
  });

  it('renders sex as "Male 🐕" for M', () => {
    setup({ sex: 'M' });
    expect(screen.getByText(/male/i)).toBeInTheDocument();
  });

  it('renders sex as "Female 🐩" for F', () => {
    setup({ sex: 'F' });
    expect(screen.getByText(/female/i)).toBeInTheDocument();
  });

  it('renders raw sex value for unknown sex', () => {
    setup({ sex: 'X' });
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('renders mother and father IDs', () => {
    setup();
    expect(screen.getByText('#0')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('renders owner address', () => {
    setup();
    expect(screen.getByText(defaultProps.owner)).toBeInTheDocument();
  });

  it('renders Verified On-Chain badge', () => {
    setup();
    expect(screen.getByText(/verified on-chain/i)).toBeInTheDocument();
  });

  it('copies owner address when Copy button is clicked', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.owner);
  });

  it('shows "Copied!" text after clicking copy', async () => {
    vi.useFakeTimers();
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    });
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    vi.useRealTimers();
  });
});
