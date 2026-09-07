import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./features/navigation', () => ({
  useAppNavigation: () => ({
    isLoadingTransition: true,
  }),
  renderView: vi.fn(),
}));

test('renders the app loading shell', () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
