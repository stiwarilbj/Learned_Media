// Generated from Website/lib/worker-recovery.ts.
(function(scope){ const exports = {};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRecoveringSearchWorker = createRecoveringSearchWorker;
function createRecoveringSearchWorker(factory, options = {}) {
    const clock = options.clock ?? { now: () => performance.now(), schedule: (callback, delay) => setTimeout(callback, delay), cancel: (timer) => clearTimeout(timer) };
    const requestTimeout = options.requestTimeoutMs ?? 15000, initializeTimeout = options.initializeTimeoutMs ?? 45000;
    let transport, generation = 0, stopped = false, restarts = 0;
    let timer, initialization;
    const requests = new Map();
    const revision = (message) => message?.catalogRevision ?? message?.revision;
    const id = (message) => message?.requestId ?? message?.id;
    function schedule() {
        if (timer !== undefined)
            clock.cancel(timer);
        timer = undefined;
        if (stopped)
            return;
        let deadline = initialization?.deadline ?? Infinity;
        for (const request of requests.values())
            deadline = Math.min(deadline, request.deadline);
        if (Number.isFinite(deadline))
            timer = clock.schedule(() => {
                timer = undefined;
                if ((initialization?.deadline ?? Infinity) <= clock.now() || [...requests.values()].some(request => request.deadline <= clock.now()))
                    fail();
                else
                    schedule();
            }, Math.max(0, deadline - clock.now()));
    }
    function retire() {
        generation++;
        transport?.terminate();
        initialization = undefined;
        requests.clear();
        if (timer !== undefined)
            clock.cancel(timer);
        timer = undefined;
    }
    function fail() {
        if (stopped)
            return;
        retire();
        if (restarts++ === 0 && facade.onrestart) {
            try {
                connect();
                facade.onrestart();
                return;
            }
            catch {
                retire();
            }
        }
        stopped = true;
        facade.onerror?.();
    }
    function connect() {
        const current = factory(), epoch = ++generation;
        transport = current;
        current.onerror = current.onmessageerror = () => { if (!stopped && epoch === generation)
            fail(); };
        current.onmessage = event => {
            if (stopped || epoch !== generation)
                return;
            const reply = event.data;
            if (!reply || typeof reply !== 'object') {
                fail();
                return;
            }
            if (reply.type === 'rebuild' && initialization) {
                fail();
                return;
            }
            const request = requests.get(id(reply)), matches = request && request.revision === revision(reply);
            if (reply.type === 'progress') {
                if (matches) {
                    request.deadline = clock.now() + requestTimeout;
                    schedule();
                }
                return;
            }
            if (reply.type === 'failed') {
                if (matches)
                    fail();
                return;
            }
            if (reply.type === 'ready' && initialization?.revision === revision(reply)) {
                initialization = undefined;
                for (const request of requests.values())
                    request.deadline = clock.now() + requestTimeout;
            }
            if (matches || reply.type === 'invalid' || reply.type === 'stale' || reply.type === 'eligibility-stale')
                requests.delete(id(reply));
            // Native video results predate the explicit "results" discriminator.
            if (matches && (reply.type === 'results' || Array.isArray(reply.candidates)))
                restarts = 0;
            schedule();
            try {
                facade.onmessage?.(event);
            }
            catch {
                fail();
            }
        };
    }
    const facade = {
        onmessage: null, onerror: null, onrestart: null,
        postMessage(message) {
            if (stopped)
                return;
            if (message.type === 'initialize' || message.type === 'update' && options.updatesAcknowledge)
                initialization = { revision: revision(message), deadline: initialization?.deadline ?? clock.now() + initializeTimeout };
            if (message.type === 'search') {
                // These search engines supersede their previous job when a new one starts.
                requests.clear();
                requests.set(id(message), { revision: revision(message), deadline: initialization ? Infinity : clock.now() + requestTimeout });
            }
            if (message.type === 'cancel') {
                if (id(message) === undefined || [...requests.keys()].every(active => id(message) >= active))
                    requests.clear();
                else
                    requests.delete(id(message));
            }
            schedule();
            try {
                transport.postMessage(message);
            }
            catch {
                fail();
            }
        },
        terminate() { stopped = true; retire(); }
    };
    connect();
    return facade;
}

scope.LEARNED_MEDIA_WORKER_RECOVERY = exports; })(globalThis);
