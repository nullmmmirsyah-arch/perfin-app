type ContentStateLoading = { status: 'loading' };
type ContentStateEmpty = { status: 'empty' };
type ContentStateError = { status: 'error'; error: Error };
type ContentStateSuccess<T> = { status: 'success'; data: T };

export type ContentStateResult<T> =
  | ContentStateLoading
  | ContentStateEmpty
  | ContentStateError
  | ContentStateSuccess<T>;

type UseContentStateOptions<T> = {
  isEmpty?: (data: T) => boolean;
  error?: Error | null;
};

export function useContentState<T>(
  queryResult: T | undefined,
  options?: UseContentStateOptions<T>
): ContentStateResult<T> {
  const { isEmpty, error } = options ?? {};

  if (error) {
    return { status: 'error', error };
  }

  if (queryResult === undefined) {
    return { status: 'loading' };
  }

  if (isEmpty ? isEmpty(queryResult) : false) {
    return { status: 'empty' };
  }

  return { status: 'success', data: queryResult };
}
