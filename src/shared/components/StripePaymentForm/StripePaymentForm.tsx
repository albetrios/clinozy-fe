import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { stripeBillingReturnUrl } from '@/lib/billing/stripe-return.ts';
import { getStripePromise } from '@/shared/billing/load-stripe.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';

type StripeBillingIntent = 'payment' | 'setup';

interface StripePaymentFormInnerProps {
  intent: StripeBillingIntent;
  onComplete: () => void;
  onCancel: () => void;
}

const FORM_KEYS = SETTINGS_KEYS.panels.billing.paymentForm;

/** The submit button's key: save a card (setup) or confirm a payment, and its busy form. */
function submitLabelKey(intent: StripeBillingIntent, isSubmitting: boolean): string {
  if (intent === 'setup') {
    return isSubmitting ? FORM_KEYS.savingMethod : FORM_KEYS.saveMethod;
  }
  return isSubmitting ? FORM_KEYS.confirmingPayment : FORM_KEYS.confirmPayment;
}

function StripePaymentFormInner({
  intent,
  onComplete,
  onCancel,
}: StripePaymentFormInnerProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!(stripe && elements)) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const returnUrl = stripeBillingReturnUrl();
    const result =
      intent === 'setup'
        ? await stripe.confirmSetup({
            elements,
            redirect: 'if_required',
            confirmParams: { return_url: returnUrl },
          })
        : await stripe.confirmPayment({
            elements,
            redirect: 'if_required',
            confirmParams: { return_url: returnUrl },
          });

    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message ?? 'Payment could not be completed.');
      return;
    }

    onComplete();
  }

  return (
    <div className="flex flex-col gap-3" data-testid="stripe-payment-form">
      <PaymentElement />
      {errorMessage ? (
        <p
          className="text-destructive text-xs"
          data-testid="stripe-payment-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {/* A drawer footer's order (`_patterns.md:35`): close, then the primary. */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="stripe-payment-cancel"
        >
          {t(FORM_KEYS.cancel)}
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!(stripe && elements) || isSubmitting}
          data-testid="stripe-payment-submit"
        >
          {t(submitLabelKey(intent, isSubmitting))}
        </Button>
      </div>
    </div>
  );
}

export interface StripePaymentFormProps {
  clientSecret: string;
  intent?: StripeBillingIntent;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Stripe Payment Element — subscription payment (PaymentIntent) or add card (SetupIntent).
 */
export function StripePaymentForm({
  clientSecret,
  intent = 'payment',
  onComplete,
  onCancel,
}: StripePaymentFormProps) {
  return (
    <Elements stripe={getStripePromise()} options={{ clientSecret }}>
      <StripePaymentFormInner
        intent={intent}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    </Elements>
  );
}
