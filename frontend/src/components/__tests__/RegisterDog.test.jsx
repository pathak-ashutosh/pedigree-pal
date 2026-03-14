import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterDog } from '../RegisterDog';

function setup(props = {}) {
  const registerDog = props.registerDog ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const utils = render(<RegisterDog registerDog={registerDog} onCancel={onCancel} />);
  return { ...utils, registerDog, onCancel };
}

describe('RegisterDog', () => {
  it('renders form fields', () => {
    setup();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/breed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sex/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mother id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/father id/i)).toBeInTheDocument();
  });

  it('renders Register and Cancel buttons', () => {
    setup();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const { onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls registerDog with form values on submit', async () => {
    const { registerDog } = setup();
    await userEvent.type(screen.getByLabelText(/name/i), 'Rex');
    await userEvent.type(screen.getByLabelText(/breed/i), 'Labrador');
    await userEvent.selectOptions(screen.getByLabelText(/sex/i), 'M');
    await userEvent.type(screen.getByLabelText(/age/i), '3');
    await userEvent.type(screen.getByLabelText(/mother id/i), '0');
    await userEvent.type(screen.getByLabelText(/father id/i), '0');
    fireEvent.submit(screen.getByRole('button', { name: /register/i }).closest('form'));
    expect(registerDog).toHaveBeenCalledWith('Rex', 'Labrador', 'M', '3', '0', '0');
  });

  it('does not call registerDog when required fields are empty', () => {
    const { registerDog } = setup();
    fireEvent.submit(screen.getByRole('button', { name: /register/i }).closest('form'));
    expect(registerDog).not.toHaveBeenCalled();
  });

  it('sex select has Male and Female options', () => {
    setup();
    const select = screen.getByLabelText(/sex/i);
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('M');
    expect(options).toContain('F');
  });

  it('age and ID inputs have min=0', () => {
    setup();
    expect(screen.getByLabelText(/age/i)).toHaveAttribute('min', '0');
    expect(screen.getByLabelText(/mother id/i)).toHaveAttribute('min', '0');
    expect(screen.getByLabelText(/father id/i)).toHaveAttribute('min', '0');
  });
});
