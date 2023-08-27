import { Beacon } from "./Beacon";
import { SignalData } from "./response";
import Peer, { Instance } from 'simple-peer-light';

export type SelfHandler = () => void;
export type PeerHandler = (peerId: string) => void;
export type PeerStreamHandler = (peerId: string, stream: MediaStream) => void;

export type ActionSender<T> = (data: T, ...peers: Array<string>) => void;
export type ActionReceiver<T> = (data: T, peerId: string) => void;
export type ActionReceiverSetter<T> = (handler: ActionReceiver<T>) => void;
export type ActionDuplex<T> = [ActionSender<T>, ActionReceiverSetter<T>];

interface Payload {
	action: string;
	data: any;
}

export class Bridge<T = undefined> {
	private beacon: Beacon<T>;

	private _ready: Promise<void>;
	private _you?: string;
	private _room?: string;
	private _data?: T;
	private _stream?: MediaStream;

	private _peers: Map<string, Instance> = new Map();
	private _actions: Map<string, ActionReceiver<any>> = new Map();

	private _onJoin: SelfHandler = () => {};
	private _onLeave: SelfHandler = () => {};
	private _onPeerStream: PeerStreamHandler = () => {};
	private _onPeerJoin: PeerHandler = () => {};
	private _onPeerLeave: PeerHandler = () => {};

	public constructor(beacon: Beacon<T>) {
		this.beacon = beacon;

		this.beacon.addEventListener('signal', ev => this.handleSignal(ev.detail));

		this._ready = new Promise((res, rej) => {
			const onOpen = () => {
				this.beacon.removeEventListener('error', onError);
				res();
			};
			const onError = () => {
				this.beacon.removeEventListener('open', onOpen);
				rej();
			};

			this.beacon.addEventListener("open", onOpen, { once: true });
			this.beacon.addEventListener("error", onError, { once: true });
		});
	}

	public get ready() {
		return this._ready;
	}

	public get you() {
		return this._you;
	}

	public get room() {
		return this._room;
	}

	public get data() {
		return this._data;
	}

	public static withBeacon<T>(url: string): Bridge<T> {
		return new this(new Beacon<T>(url));
	}

	private addPeer(peerId: string, initiator: boolean): Instance {
		const peer = new Peer({ initiator, stream: this._stream });

		peer.once('connect', () => this._onPeerJoin(peerId));
		peer.once('error', () => this._peers.delete(peerId));
		peer.once('close', () => {
			this._onPeerLeave(peerId);
			this._peers.delete(peerId);
		});

		peer.on('signal', data => this.beacon.signal(peerId, data));
		peer.on('data', data => this.handleData(peerId, data));
		peer.on('stream', stream => this._onPeerStream(peerId, stream));

		this._peers.set(peerId, peer);

		return peer;
	}

	private handleSignal(signalData: SignalData) {
		if (!this._peers.has(signalData.peer)) {
			return this.addPeer(signalData.peer, false).signal(signalData.data);
		}

		this._peers.get(signalData.peer)!.signal(signalData.data)
	}

	private handleData(peer: string, data: string) {
		const payload: Payload = JSON.parse(data);
		this._actions.get(payload.action)?.(payload.data, peer);
	}

	private sendData(action: string, data: any, peers: Array<string>) {
		const payload = JSON.stringify({ action, data });
		this._peers.forEach((peer, id) => {
			if (peers.length === 0 || peers.includes(id)) {
				peer.send(payload);
			}
		});
	}

	public create(data: T, stream?: MediaStream) {
		this._data = data;
		this._stream = stream;
		return this.beacon.create(data);
	}

	public getInfo(room: string) {
		return this.beacon.getInfo(room);
	}

	public async join(room: string, stream?: MediaStream) {
		const data = await this.beacon.join(room);
		this._you = data.you;
		this._data = data.data;
		this._stream = stream;

		await Promise.all(data.peers.map(peerId =>
			new Promise<void>((res, rej) => {
				const peer = this.addPeer(peerId, true);
				peer.once('connect', res);
				peer.once('error', rej);
			}),
		));

		this._onJoin();

		return data;
	}

	public leave() {
		this._peers.forEach(peer => peer.destroy());
		this.beacon.leave();
		this._onLeave();
	}

	public onJoin(handler: SelfHandler) {
		this._onJoin = handler;
	}

	public onLeave(handler: SelfHandler) {
		this._onLeave = handler;
	}

	public onPeerStream(handler: PeerStreamHandler) {
		this._onPeerStream = handler;
	}

	public onPeerJoin(handler: PeerHandler) {
		this._onPeerJoin = handler;
	}

	public onPeerLeave(handler: PeerHandler) {
		this._onPeerLeave = handler;
	}

	public makeAction<T>(name: string): ActionDuplex<T> {
		return [
			(data, ...peers) => this.sendData(name, data, peers),
			(handler) => this._actions.set(name, handler),
		];
	}
}
