export interface CreatePayload<T> {
	data?: T;
}

export interface CreateRequest<T> {
	method: 'create';
	params: CreatePayload<T>
}

export interface InfoPayload {
	room: string;
}

export interface InfoRequest {
	method: 'info';
	params: InfoPayload;
}

export interface JoinPayload {
	room: string;
}

export interface JoinRequest {
	method: 'join';
	params: JoinPayload;
}

export interface SignalPayload {
	peer: string;
	data: any;
}

export interface SignalRequest {
	method: 'signal';
	params: SignalPayload;
}

export type Request<T> = |
	CreateRequest<T> |
	InfoRequest |
	JoinRequest |
	SignalRequest;
