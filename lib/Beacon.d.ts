import { CreatedData, ErrorType, InfoData, JoinedData, SignalData } from "./response";
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
type TypedEventListener<M, T extends keyof M> = (evt: M[T]) => void | Promise<void>;
interface TypedEventListenerObject<M, T extends keyof M> {
    handleEvent: (evt: M[T]) => void | Promise<void>;
}
type ValueIsEvent<T> = {
    [key in keyof T]: Event;
};
type TypedEventListenerOrEventListenerObject<M, T extends keyof M> = TypedEventListener<M, T> | TypedEventListenerObject<M, T>;
export interface TypedEventTarget<M extends ValueIsEvent<M>> {
    addEventListener: <T extends keyof M & string>(type: T, listener: TypedEventListenerOrEventListenerObject<M, T> | null, options?: boolean | AddEventListenerOptions) => void;
    removeEventListener: <T extends keyof M & string>(type: T, callback: TypedEventListenerOrEventListenerObject<M, T> | null, options?: EventListenerOptions | boolean) => void;
}
export declare class TypedEventTarget<M extends ValueIsEvent<M>> extends EventTarget {
    dispatchTypedEvent<T extends keyof M>(type: T, event: InnerEvent<M[T]>): boolean;
}
export declare class Beacon<T> extends TypedEventTarget<BeaconEventMap<T>> {
    private ws;
    constructor(url: string);
    get connected(): boolean;
    static isUp(url: string): Promise<boolean>;
    create(data: T): Promise<CreatedData>;
    getInfo(room: string): Promise<InfoData<T>>;
    join(room: string): Promise<JoinedData<T>>;
    signal(peer: string, data: unknown): void;
    leave(): void;
    private send;
    private emit;
    private intoPromise;
}
export {};
