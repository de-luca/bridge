import { Beacon } from "./Beacon";
import { SignalData } from "./response";
import Peer, { Instance } from 'simple-peer-light';

export type SelfHandler = () => void;
export type PeerHandler = (peerId: string) => void;

export type ActionSender<T> = (data: T, ...peers: Array<string>) => void;
export type ActionReceiver<T> = (data: T, peerId: string) => void;
export type ActionReceiverSetter<T> = (handler: ActionReceiver<T>) => void;
export type ActionDuplex<T> = [ActionSender<T>, ActionReceiverSetter<T>];

interface Payload {
	action: string;
	data: any;
}

export class Bridge<T = undefined> {
	#beacon: Beacon<T>;

	#ready: Promise<void>;
	#you?: string;
	#room?: string;
	#data?: T;

	#peers: Map<string, Instance> = new Map();
	#actions: Map<string, ActionReceiver<any>> = new Map();

	#onJoin: SelfHandler = () => {};
	#onLeave: SelfHandler = () => {};
	#onPeerJoin: PeerHandler = () => {};
	#onPeerLeave: PeerHandler = () => {};

	public constructor(beacon: Beacon<T>) {
		this.#beacon = beacon;

		this.#beacon.addEventListener('signal', ev => this.handleSignal(ev.detail));

		this.#ready = new Promise((res, rej) => {
			const onOpen = () => {
				this.#beacon.removeEventListener('error', onError);
				res();
			};
			const onError = () => {
				this.#beacon.removeEventListener('open', onOpen);
				rej();
			};

			this.#beacon.addEventListener("open", onOpen, { once: true });
			this.#beacon.addEventListener("error", onError, { once: true });
		});
	}

	public get ready() {
		return this.#ready;
	}

	public get you() {
		return this.#you;
	}

	public get room() {
		return this.#room;
	}

	public get data() {
		return this.#data;
	}

	public static withBeacon<T>(url: string): Bridge<T> {
		return new this(new Beacon<T>(url));
	}

	private addPeer(peerId: string, initiator: boolean): Instance {
		const peer = new Peer({ initiator });

		peer.once('connect', () => this.#onPeerJoin(peerId));
		peer.once('error', () => this.#peers.delete(peerId));
		peer.once('close', () => {
			this.#onPeerLeave(peerId);
			this.#peers.delete(peerId);
		});

		peer.on('signal', data => this.#beacon.signal(peerId, data));
		peer.on('data', data => this.handleData(peerId, data));

		this.#peers.set(peerId, peer);

		return peer;
	}

	private handleSignal(signalData: SignalData) {
		if (!this.#peers.has(signalData.peer)) {
			return this.addPeer(signalData.peer, false).signal(signalData.data);
		}

		this.#peers.get(signalData.peer)!.signal(signalData.data)
	}

	private handleData(peer: string, data: string) {
		const payload: Payload = JSON.parse(data);
		this.#actions.get(payload.action)?.(payload.data, peer);
	}

	private sendData(action: string, data: any, peers: Array<string>) {
		const payload = JSON.stringify({ action, data });
		this.#peers.forEach((peer, id) => {
			if (peers.length === 0 || peers.includes(id)) {
				peer.send(payload);
			}
		});
	}

	public create(data: T) {
		this.#data = data;
		return this.#beacon.create(data);
	}

	public getInfo(room: string) {
		return this.#beacon.getInfo(room);
	}

	public async join(room: string) {
		const data = await this.#beacon.join(room);
		this.#you = data.you;
		this.#data = data.data;

		await Promise.all(data.peers.map(peerId =>
			new Promise<void>((res, rej) => {
				const peer = this.addPeer(peerId, true);
				peer.once('connect', res);
				peer.once('error', rej);
			}),
		));

		this.#onJoin();

		return data;
	}

	public leave() {
		this.#peers.forEach(peer => peer.destroy());
		this.#onLeave();
	}

	public onJoin(handler: SelfHandler) {
		this.#onJoin = handler;
	}

	public onLeave(handler: SelfHandler) {
		this.#onLeave = handler;
	}

	public onPeerJoin(handler: PeerHandler) {
		this.#onPeerJoin = handler;
	}

	public onPeerLeave(handler: PeerHandler) {
		this.#onPeerLeave = handler;
	}

	public makeAction<T>(name: string): ActionDuplex<T> {
		return [
			(data, ...peers) => this.sendData(name, data, peers),
			(handler) => this.#actions.set(name, handler),
		];
	}
}
