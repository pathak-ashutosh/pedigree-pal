import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckDog } from '../CheckDog';

function setup(props = {}) {
  const retrieveDog = props.retrieveDog ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const utils = render(<CheckDog retrieveDog={retrieveDog} onCancel={onCancel} />);
  return { ...utils, retrieveDog, onCancel };
}

describe('CheckDog', () => {
  it('renders Dog ID input', () => {
    setup();
    expect(screen.getByLabelText(/dog id/i)).toBeInTheDocument();
  });

  it('renders Look up and Cancel buttons', () => {
    setup();
    expect(screen.getByRole('button', { name: /look up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const { onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls retrieveDog with entered ID on submit', async () => {
    const { retrieveDog } = setup();
    await userEvent.type(screen.getByLabelText(/dog id/i), '5');
    fireEvent.submit(screen.getByRole('button', { name: /look up/i }).closest('form'));
    expect(retrieveDog).toHaveBeenCalledWith('5');
  });

  it('does not call retrieveDog when input is empty', () => {
    const { retrieveDog } = setup();
    fireEvent.submit(screen.getByLabelText(/dog id/i).closest('form'));
    expect(retrieveDog).not.toHaveBeenCalled();
  });

  it('Dog ID input has min=0 and type=number', () => {
    setup();
    const input = screen.getByLabelText(/dog id/i);
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '0');
  });
});
