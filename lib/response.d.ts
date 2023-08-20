export type ErrorType = 'ROOM_DOES_NOT_EXISTS';
export interface CreatedData {
    you: string;
    room: string;
}
export interface CreatedResponse {
    event: 'created';
    data: CreatedData;
}
export interface InfoData<T> {
    peers: number;
    data: T;
}
export interface InfoResponse<T> {
    event: 'info';
    data: InfoData<T>;
}
export interface JoinedData<T> {
    you: string;
    data: T;
    peers: Array<string>;
}
export interface JoinedResponse<T> {
    event: 'joined';
    data: JoinedData<T>;
}
export interface SignalData {
    peer: string;
    data: any;
}
export interface SignalResponse {
    event: 'signal';
    data: SignalData;
}
export interface ErrorResponse {
    event: 'error';
    data: ErrorType;
}
export type Response<T> = CreatedResponse | InfoResponse<T> | JoinedResponse<T> | SignalResponse | ErrorResponse;
