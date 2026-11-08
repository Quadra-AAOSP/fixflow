/** Rejects results from requests superseded by a refresh or identity change. */
export function createRequestGate() {
  let generation = 0;
  return {
    begin: () => ++generation,
    invalidate: () => { generation++; },
    current: (request: number) => request === generation,
  };
}

export function nextReportPage(page: number, totalPages: number): number | null {
  return page + 1 < totalPages ? page + 1 : null;
}

export function createReportPageRequests() {
  const gate = createRequestGate();
  let appending = false;
  return {
    begin(page: number) {
      if (page > 0 && appending) return null;
      appending = page > 0;
      return gate.begin();
    },
    current: gate.current,
    finish(request: number) {
      if (!gate.current(request)) return false;
      appending = false;
      return true;
    },
    invalidate() {
      gate.invalidate();
      appending = false;
    },
  };
}

export function appendReportPage<T extends { id: number }>(current: T[], next: T[]): T[] {
  return [...new Map([...current, ...next].map(report => [report.id, report])).values()];
}
