import test from "node:test";
import assert from "node:assert/strict";
import { createRequestGeneration, loadPlanEvents } from "../src/planRequests.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("late events from yesterday cannot replace today's cards or finish its loading state", async () => {
  const requests = createRequestGeneration();
  const yesterday = { local: deferred(), trip: deferred() };
  const today = { local: deferred(), trip: deferred() };
  let events = {};
  let loading = true;
  const start = (pending) => loadPlanEvents({
    load: (kind) => pending[kind].promise,
    isCurrent: requests.begin(),
    onEvents: (partial) => { events = { ...events, ...partial }; },
    onSettled: () => { loading = false; },
  });
  const oldWork = start(yesterday);
  const currentWork = start(today);
  today.local.resolve({ local: ["Today's story time"] });
  await Promise.resolve();
  yesterday.local.resolve({ local: ["Yesterday's story time"] });
  yesterday.trip.reject(new Error("old search failed"));
  await oldWork;
  assert.deepEqual(events, { local: ["Today's story time"] });
  assert.equal(loading, true);
  today.trip.resolve({ worthTheTrip: ["Today's festival"] });
  await currentWork;
  assert.deepEqual(events, { local: ["Today's story time"], worthTheTrip: ["Today's festival"] });
  assert.equal(loading, false);
});

test("sign-out/unmount invalidation discards pending results and their completion", async () => {
  const requests = createRequestGeneration();
  const pending = deferred();
  const isCurrent = requests.begin();
  let writes = 0;
  const work = loadPlanEvents({
    load: () => pending.promise,
    isCurrent,
    onEvents: () => { writes += 1; },
    onSettled: () => { writes += 1; },
  });
  requests.invalidate();
  pending.resolve({ local: ["old account result"] });
  await work;
  assert.equal(isCurrent(), false);
  assert.equal(writes, 0);
});

test("saving the current plan shares its request lifetime, while a new build supersedes it", () => {
  const requests = createRequestGeneration();
  const eventsAreCurrent = requests.begin();
  const saveIsCurrent = requests.current();
  assert.equal(eventsAreCurrent(), true);
  assert.equal(saveIsCurrent(), true);
  const newBuildIsCurrent = requests.begin();
  assert.equal(eventsAreCurrent(), false);
  assert.equal(saveIsCurrent(), false);
  assert.equal(newBuildIsCurrent(), true);
});
