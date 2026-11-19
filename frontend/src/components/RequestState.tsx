interface RequestStateProps {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyMessage?: string;
}

export function RequestState({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
}: RequestStateProps) {
  if (loading) {
    return (
      <p className="request-state" role="status">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className="request-state error-state" role="alert">
        {error.message}
      </p>
    );
  }
  if (empty) {
    return (
      <p className="request-state" role="status">
        {emptyMessage}
      </p>
    );
  }
  return null;
}
