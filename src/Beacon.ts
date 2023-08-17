import { Request } from "./request";
import { CreatedData, ErrorType, InfoData, JoinedData, Response, SignalData } from "./response";

export type Error = ErrorType | 'SOCKET_ERROR';

export interface BeaconEventMap<T> {
	open: CustomEvent<null>;
	close: CustomEvent<null>;
	created: CustomEvent<CreatedData>;
	info: CustomEvent<InfoData<T>>;
	joined: CustomEvent<JoinedData<T>>;
	signal: CustomEvent<SignalData>;
	error: CustomEvent<Error>;
}

type InnerEvent<T> = T extends CustomEvent<infer X> ? X : never;

type TypedEventListener<M, T extends keyof M> = (
	evt: M[T]
) => void | Promise<void>;

interface TypedEventListenerObject<M, T extends keyof M> {
	handleEvent: (evt: M[T]) => void | Promise<void>;
}

type ValueIsEvent<T> = {
	[key in keyof T]: Event;
};

type TypedEventListenerOrEventListenerObject<M, T extends keyof M> =
	| TypedEventListener<M, T>
	| TypedEventListenerObject<M, T>;

export interface TypedEventTarget<M extends ValueIsEvent<M>> {
	addEventListener: <T extends keyof M & string>(
		type: T,
		listener: TypedEventListenerOrEventListenerObject<M, T> | null,
		options?: boolean | AddEventListenerOptions
	) => void;

	removeEventListener: <T extends keyof M & string>(
		type: T,
		callback: TypedEventListenerOrEventListenerObject<M, T> | null,
		options?: EventListenerOptions | boolean
	) => void;
}

export class TypedEventTarget<M extends ValueIsEvent<M>> extends EventTarget {
	public dispatchTypedEvent<T extends keyof M>(
		type: T,
		event: InnerEvent<M[T]>
	): boolean {
		return super.dispatchEvent(new CustomEvent(type as string, { detail: event }));
	}
}

export class Beacon<T> extends TypedEventTarget<BeaconEventMap<T>> {
	#ws: WebSocket;

	public constructor(url: string) {
		super();
		this.#ws = new WebSocket(url);
		this.#ws.addEventListener('open', () => this.dispatchTypedEvent('open', null));
		this.#ws.addEventListener('close', () => this.dispatchTypedEvent('close', null));
		this.#ws.addEventListener('error', () => this.dispatchTypedEvent('error', 'SOCKET_ERROR'));
		this.#ws.addEventListener('message', msg => this.emit(msg));
	}

	public get connected(): boolean {
		return this.#ws.readyState === WebSocket.OPEN;
	}

	public static isUp(url: string): Promise<boolean> {
		return new Promise((res, rej) => {
			const ws = new WebSocket(url);
			ws.addEventListener('open', () => {
				ws.close();
				res(true);
			}, { once: true });
			ws.addEventListener('close', () => res(false), { once: true });
			ws.addEventListener('error', rej, { once: true });
		})
	}

	public create(data: T) {
		this.send({ method: "create", params: { data } });
		return this.intoPromise('created');
	}

	public getInfo(room: string) {
		this.send({ method: "info", params: { room } });
		return this.intoPromise('info');
	}

	public join(room: string) {
		this.send({ method: "join", params: { room } });
		return this.intoPromise('joined');
	}

	public signal(peer: string, data: unknown) {
		this.send({ method: "signal", params: { peer, data } });
	}

	private send(payload: Request<T>) {
		this.#ws.send(JSON.stringify(payload));
	}

	private emit(message: MessageEvent<string>) {
		const payload: Response<T> = JSON.parse(message.data);
		this.dispatchTypedEvent(payload.event, payload.data);
	}

	private intoPromise<K extends keyof BeaconEventMap<T>>(event: K): Promise<BeaconEventMap<T>[K]["detail"]> {
		return new Promise((res, rej) => {
			this.addEventListener(event, ev => res(ev.detail), { once: true });
			this.addEventListener('error', ev => rej(ev.detail), { once: true });
		});
	}
}
