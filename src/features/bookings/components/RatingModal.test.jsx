import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RatingModal from './RatingModal';

describe('RatingModal', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:review-preview');
    URL.revokeObjectURL = jest.fn();
  });

  test('submits a star rating, comment, and optional image', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const image = new File(['review image'], 'finished-work.png', { type: 'image/png' });

    render(
      <RatingModal
        booking={{ workerName: 'Paolo Rivera Mendoza', serviceType: 'Handyman Home Repairs' }}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '4 stars' }));
    fireEvent.change(screen.getByPlaceholderText('How was the service?'), { target: { value: 'Clean and careful work.' } });
    fireEvent.change(screen.getByLabelText('Add review photo'), { target: { files: [image] } });
    expect(screen.getByAltText('Review upload preview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      rating: 4,
      comment: 'Clean and careful work.',
      imageFile: image,
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('rejects unsupported image types', () => {
    render(<RatingModal booking={{ workerName: 'Paolo' }} onSubmit={jest.fn()} onClose={jest.fn()} />);
    const invalidFile = new File(['not an image'], 'review.txt', { type: 'text/plain' });

    fireEvent.change(screen.getByLabelText('Add review photo'), { target: { files: [invalidFile] } });

    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG, or WebP');
  });
});
