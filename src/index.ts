type Task = () => any;

type FlowItem = {
	group: PropertyKey;
	runner: () => AdvancePromise;
	promise?: AdvancePromise;
	origin: Task;
};

type AdvancePromise = Promise<any> & { abort: () => void };

const DEFAULT_KEY: PropertyKey = "default";

function advanceFlowFunction(item: Task) {
	let abort: any, complete: any;
	const abortPromise = new Promise((resolve, reject) => {
		abort = reject;
		complete = resolve;
	});
	const itemPromise = new Promise((resolve, reject) => {
		try {
			const result = item();
			if (result instanceof Promise) {
				result.then(resolve).catch(reject);
			} else {
				resolve(true);
			}
		} catch (e) {
			reject(e);
		}
	});

	itemPromise.finally(() => {
		complete?.();
	});

	const result = Promise.race([abortPromise, itemPromise]);

	(result as AdvancePromise).abort = abort;

	return result as AdvancePromise;
}

export abstract class ConcurrencyPoolLife {
	onStart() {}
	onTurn(item: FlowItem) {}
	onAbort(item: FlowItem) {}
	onStop() {}
}

export class XConcurrencyPromise extends ConcurrencyPoolLife {
	protected groupSet = new Set<PropertyKey>();

	protected pool: FlowItem[] = [];

	protected freezer: Record<PropertyKey, FlowItem[]> = Object.create(null);

	protected runningMap: Map<Task, FlowItem> = new Map();

	protected max = 5;

	isStop = false;

	constructor(max?: number) {
		super();
		max && (this.max = max);
	}

	setLimit(max: number) {
		this.max = max;
		this.run();
	}

	isGroupFreezed(groupKey: PropertyKey) {
		return !!this.freezer[groupKey];
	}

	protected setFreezerValue(key: PropertyKey, value: FlowItem[]) {
		if (this.freezer[key]) {
			this.freezer[key].push(...value);
		} else {
			this.freezer[key] = [...value];
		}
	}

	feedArray(arr: Task[], groupKey = DEFAULT_KEY) {
		this.groupSet.add(groupKey);
		const flowItemArray = arr.map((fn) => ({
			group: groupKey,
			runner: () => advanceFlowFunction(fn),
			origin: fn,
		}));
		if (this.isGroupFreezed(groupKey)) {
			this.setFreezerValue(groupKey, flowItemArray);
		} else {
			this.pool.push(...flowItemArray);
		}

		this.run();
	}

	feed(fn: Task, groupKey = DEFAULT_KEY) {
		this.groupSet.add(groupKey);
		const item: FlowItem = {
			group: groupKey,
			runner: () => advanceFlowFunction(fn),
			origin: fn,
		};
		if (this.isGroupFreezed(groupKey)) {
			this.setFreezerValue(groupKey, [item]);
		} else {
			this.pool.push(item);
		}

		this.run();
	}

	freeze(groupKey = DEFAULT_KEY) {
		if (this.isGroupFreezed(groupKey)) return;

		this.runningMap.forEach((item) => {
			if (item.group === groupKey) {
				this.abortItem(item);
				this.setFreezerValue(groupKey, [item]);
			}
		});

		const flowItemArray = this.pool.filter((item) => item.group === groupKey);

		this.pool = this.pool.filter((item) => item.group !== groupKey);

		this.setFreezerValue(groupKey, flowItemArray);

		if (this.runningMap.size === 0) this.run();
	}

	freezeAll() {
		this.groupSet.forEach((key) => this.freeze(key));
	}

	unfreeze(groupKey = DEFAULT_KEY, front = true) {
		if (!this.isGroupFreezed(groupKey)) return;

		const freezeItems = this.freezer[groupKey];

		delete this.freezer[groupKey];

		this.pool = front
			? [...freezeItems, ...this.pool]
			: [...this.pool, ...freezeItems];

		this.run();
	}

	unfreezeAll(front = true) {
		this.groupSet.forEach((key) => this.unfreeze(key, front));
	}

	run() {
		if (this.isStop) return;

		const runningCount = this.runningMap.size;

		if (runningCount >= this.max) return;

		const wantage = this.max - runningCount;

		this.pool.splice(0, wantage).forEach((item) => {
			this.runningMap.set(item.origin, item);
			const xPromise = item.runner();
			item.promise = xPromise;
			this.onTurn(item);
			xPromise.finally(() => {
				this.runningMap.delete(item.origin);
				this.run();
			});
		});
	}

	stop() {
		this.isStop = true;
		this.onStop();
	}

	resume() {
		this.isStop = false;
		this.run();
	}

	abort(fn: Task, returnToPool = false) {
		const map = this.runningMap;
		const item = map.get(fn);
		if (!item) return;
		this.abortItem(item, returnToPool);
	}

	abortItem(item: FlowItem, returnToPool = false) {
		item.promise?.abort();
		this.onAbort(item);
		if (returnToPool) {
			this.pool.unshift();
		}
	}

	clear() {
		this.pool.length = 0;
		this.runningMap.forEach((item) => this.abortItem(item));
		this.runningMap.clear();
		this.groupSet.clear();
		this.isStop = false;
		this.freezer = Object.create(null);
	}
}
