/** Where a card's read stands — a query's flags and its Retry. */
export interface BentoRead {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  retry: () => void;
}

/** A query's flags as a card reads them, `refetch` its Retry. */
export function bentoRead(query: {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
}): BentoRead {
  return {
    isPending: query.isPending,
    isError: query.isError,
    isSuccess: query.isSuccess,
    retry: () => void query.refetch(),
  };
}
