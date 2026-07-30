import { useMemo, useState } from "react";

export function usePagination<T>(items: T[], defaultPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeP = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeP - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeP, pageSize]);

  const goTo = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  return {
    page: safeP,
    pageSize,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    setPage: goTo,
    setPageSize: (size: number) => { setPageSize(size); setPage(1); },
    hasNext: safeP < totalPages,
    hasPrev: safeP > 1,
  };
}
