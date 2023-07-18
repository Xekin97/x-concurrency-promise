# x-concurrency-promise

Concurrency promise controller, is a tool class implemented by typescript which can limit the number of concurrency promises executed simultaneously.

## Design

The x-concurrency-promise is designed to execute promises simultaneously, while developers can add tasks or pause execution anytime.

## Usage

```typescript
const pool = new XConcurrencyPromise(5);

new Array(100).fill(0).forEach(() => {
	pool.feed(
		() =>
			new Promise((resolve) => setTimeout(resolve, Math.random() * 5000, true))
	);
});

setTimeout(() => {
	pool.freeze();
}, 1000);

setTimeout(() => {
	pool.unfreeze();
});
```

## Event

### onStart (): void

Trigger when the pool start.

### onTurn (item: FlowItem): void

Trigger when turning to item promise.

### onAbort (item: FlowItem): void

Trigger when the item promise aborting.

### onStop (): void

Trigger when the pool stop.

## API

### setLimit (num: number): void

You can set the concurrency limit at any time, but it will never stop your task which is start.

### feed (fn: Task, groupKey: string = 'default'): void

Put a task into the concurrency pool.

You can assign a key to group your task and use other methods to handle them, like the `freeze` method.

### feedArray (fn: Task[], groupKey: string = 'default'): void

Put an array of tasks into the concurrency pool.

### freeze (groupKey = 'default'): void

Freeze your tasks with the group key you assign.

When you freeze your task executing now, it will never stop the task, but there will trigger an event called 'onAbort'.

### freezeAll

Freeze all tasks.

### unfreeze

Opposite to freeze.

### unfreezeAll

Opposite to freeze all.

### run

### stop

### resume

### abort

### abortItem

### clear
