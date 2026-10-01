// A new build, sign-out or unmount invalidates all pending work from the old
// build. Saving a plan can change its database ID without changing this token.
export function createRequestGeneration() {
  let generation = 0;
  const current = () => {
    const captured = generation;
    return () => generation === captured;
  };
  return {
    begin() {
      generation += 1;
      return current();
    },
    current,
    invalidate() { generation += 1; },
  };
}

export async function loadPlanEvents({ load, isCurrent, onEvents, onSettled }) {
  try {
    await Promise.allSettled(["local", "trip"].map(async (kind) => {
      let partial;
      try {
        partial = await load(kind);
      } catch {
        partial = kind === "local" ? { local: [] } : { worthTheTrip: [] };
      }
      if (isCurrent()) onEvents(partial);
    }));
  } finally {
    if (isCurrent()) onSettled();
  }
}
