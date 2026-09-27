import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import { axe } from 'vitest-axe';
import { z } from 'zod';

import { FormField } from './FormField.tsx';

const testSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

type TestFormValues = z.infer<typeof testSchema>;

function FormFieldWithProvider() {
  const methods = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: { username: '' },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => {})}>
        <FormField
          control={methods.control}
          name="username"
          label="Username"
          placeholder="Enter username"
        />
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

describe('FormField', () => {
  it('renders label and input', () => {
    render(<FormFieldWithProvider />);

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
  });

  it('shows error message when form has errors', async () => {
    const user = userEvent.setup();
    render(<FormFieldWithProvider />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByText('Username is required')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<FormFieldWithProvider />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
