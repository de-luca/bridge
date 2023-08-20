export class TypedEventTarget extends EventTarget {
    dispatchTypedEvent(type, event) {
        return super.dispatchEvent(new CustomEvent(type, { detail: event }));
    }
}
export class Beacon extends TypedEventTarget {
    constructor(url) {
        super();
        this.ws = new WebSocket(url);
        this.ws.addEventListener('open', () => this.dispatchTypedEvent('open', null));
        this.ws.addEventListener('close', () => this.dispatchTypedEvent('close', null));
        this.ws.addEventListener('error', () => this.dispatchTypedEvent('error', 'SOCKET_ERROR'));
        this.ws.addEventListener('message', msg => this.emit(msg));
    }
    get connected() {
        return this.ws.readyState === WebSocket.OPEN;
    }
    static isUp(url) {
        return new Promise((res, rej) => {
            const ws = new WebSocket(url);
            ws.addEventListener('open', () => {
                ws.close();
                res(true);
            }, { once: true });
            ws.addEventListener('close', () => res(false), { once: true });
            ws.addEventListener('error', rej, { once: true });
        });
    }
    create(data) {
        this.send({ method: "create", params: { data } });
        return this.intoPromise('created');
    }
    getInfo(room) {
        this.send({ method: "info", params: { room } });
        return this.intoPromise('info');
    }
    join(room) {
        this.send({ method: "join", params: { room } });
        return this.intoPromise('joined');
    }
    signal(peer, data) {
        this.send({ method: "signal", params: { peer, data } });
    }
    leave() {
        this.ws.close();
    }
    send(payload) {
        this.ws.send(JSON.stringify(payload));
    }
    emit(message) {
        const payload = JSON.parse(message.data);
        this.dispatchTypedEvent(payload.event, payload.data);
    }
    intoPromise(event) {
        return new Promise((res, rej) => {
            this.addEventListener(event, ev => res(ev.detail), { once: true });
            this.addEventListener('error', ev => rej(ev.detail), { once: true });
        });
    }
}
//# sourceMappingURL=Beacon.js.map