import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading } from '../Loading';

describe('Loading', () => {
  it('renders connecting message', () => {
    render(<Loading />);
    expect(screen.getByText(/connecting to the chain/i)).toBeInTheDocument();
  });
});
