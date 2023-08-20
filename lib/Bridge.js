import { Beacon } from "./Beacon";
import Peer from 'simple-peer-light';
export class Bridge {
    constructor(beacon) {
        this._peers = new Map();
        this._actions = new Map();
        this._onJoin = () => { };
        this._onLeave = () => { };
        this._onPeerJoin = () => { };
        this._onPeerLeave = () => { };
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
    get ready() {
        return this._ready;
    }
    get you() {
        return this._you;
    }
    get room() {
        return this._room;
    }
    get data() {
        return this._data;
    }
    static withBeacon(url) {
        return new this(new Beacon(url));
    }
    addPeer(peerId, initiator) {
        const peer = new Peer({ initiator });
        peer.once('connect', () => this._onPeerJoin(peerId));
        peer.once('error', () => this._peers.delete(peerId));
        peer.once('close', () => {
            this._onPeerLeave(peerId);
            this._peers.delete(peerId);
        });
        peer.on('signal', data => this.beacon.signal(peerId, data));
        peer.on('data', data => this.handleData(peerId, data));
        this._peers.set(peerId, peer);
        return peer;
    }
    handleSignal(signalData) {
        if (!this._peers.has(signalData.peer)) {
            return this.addPeer(signalData.peer, false).signal(signalData.data);
        }
        this._peers.get(signalData.peer).signal(signalData.data);
    }
    handleData(peer, data) {
        const payload = JSON.parse(data);
        this._actions.get(payload.action)?.(payload.data, peer);
    }
    sendData(action, data, peers) {
        const payload = JSON.stringify({ action, data });
        this._peers.forEach((peer, id) => {
            if (peers.length === 0 || peers.includes(id)) {
                peer.send(payload);
            }
        });
    }
    create(data) {
        this._data = data;
        return this.beacon.create(data);
    }
    getInfo(room) {
        return this.beacon.getInfo(room);
    }
    async join(room) {
        const data = await this.beacon.join(room);
        this._you = data.you;
        this._data = data.data;
        await Promise.all(data.peers.map(peerId => new Promise((res, rej) => {
            const peer = this.addPeer(peerId, true);
            peer.once('connect', res);
            peer.once('error', rej);
        })));
        this._onJoin();
        return data;
    }
    leave() {
        this._peers.forEach(peer => peer.destroy());
        this.beacon.leave();
        this._onLeave();
    }
    onJoin(handler) {
        this._onJoin = handler;
    }
    onLeave(handler) {
        this._onLeave = handler;
    }
    onPeerJoin(handler) {
        this._onPeerJoin = handler;
    }
    onPeerLeave(handler) {
        this._onPeerLeave = handler;
    }
    makeAction(name) {
        return [
            (data, ...peers) => this.sendData(name, data, peers),
            (handler) => this._actions.set(name, handler),
        ];
    }
}
//# sourceMappingURL=Bridge.js.map