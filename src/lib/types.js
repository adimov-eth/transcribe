"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionError = void 0;
class TranscriptionError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'TranscriptionError';
    }
}
exports.TranscriptionError = TranscriptionError;
