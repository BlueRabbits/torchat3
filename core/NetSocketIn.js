const SocksClient = require('socks').SocksClient;
const crypto = require("crypto");
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const tor = require('../tor/tor');
const torUtil = require('../tor/torUtils')
const config = require('../config');
const constant = require('../constant');

const parser = require('./parser');
const protocol = require('./protocol');
const fileHandler = require('./fileHandler');
const contact = require('./contact');

const debug = require('./debug');

class SocketIn extends EventEmitter {
    constructor(socket, buffer) {
        super();

        this.socket = socket;
        this.buffer = buffer;

        this.socket.on('close', () => { debug.log('[socket IN] close'); this.close(); })
        this.socket.on('timeout', () => { debug.log('[socket IN] timeout'); this.close(); })
        this.socket.on('error', (err) => { debug.log('[socket IN] error:', err); this.close(); })

        this.socket.on('data', (data) => { this.data(data); })
        this.socket.on('drain', () => { this.emit('drain'); })
    }

    data(data) {
        const dataStr = data.toString();
        if (dataStr.length <= 0) { return; }
        this.buffer += dataStr;
        if (this.buffer.length > constant.BufferMaximum) { this.emit('invalid'); }

        if (this.buffer.length > 0) {
            let publicKeyStr, publicKey, signedStr, signed;
            let hostname, cookie, cookieOppsite, clientName, clientVersion;
            let status, profileName, profileInfo;
            let message;
            let fileID, fileSize, fileName, parsed, blockIndex;

            while (this.buffer.indexOf('\n') > -1) {
                console.log("buffer", this.buffer);
                const parsedBuffer = parser.buffer(this.buffer);
                const dataList = parsedBuffer.dataList;
                this.buffer = parsedBuffer.leftBuffer;

                console.log("dataList", dataList);
                if (!protocol.validate(dataList)) { continue; }
                switch (dataList[0]) {
                    case 'ping':
                        publicKeyStr = dataList[1];
                        publicKey = Buffer.from(publicKeyStr, 'base64');
                        cookieOppsite = dataList[2];
                        signedStr = dataList[3];
                        signed = Buffer.from(signedStr, 'base64');

                        hostname = torUtil.generateHostname(publicKey);
                        if (torUtil.verify(publicKeyStr + cookieOppsite, signed, publicKey)) {
                            this.emit('ping', hostname, cookieOppsite);
                        }
                        else {
                            this.emit('invalid');
                        }
                        break;

                    case 'pong':
                        cookie = dataList[1];
                        clientName = dataList[2];
                        clientVersion = dataList[3];

                        this.emit('pong', cookie, clientName, clientVersion);
                        break;

                    case 'alive':
                        status = dataList[1] * 1;

                        this.emit('alive', status);
                        break;

                    case 'profile':
                        profileName = dataList[1];
                        profileInfo = dataList[2];

                        profileName = parser.removeNewline(parser.unescape(profileName));
                        profileName = parser.limitateLength(profileName, constant.MaxLenProfileName);
                        profileName = parser.letOnlyAscii(profileName);
                        profileName = parser.preventXSS(profileName);

                        profileInfo = parser.unescape(profileInfo);
                        profileInfo = parser.removeCarriageReturn(profileInfo);
                        profileInfo = parser.limitateLength(profileInfo, constant.MaxLenProfileInfo);
                        profileInfo = parser.preventXSS(profileInfo);

                        this.emit('profile', profileName, profileInfo);
                        break;

                    case 'message':
                        message = dataList[1];
                        message = parser.unescape(message);
                        message = parser.removeCarriageReturn(message);
                        message = parser.limitateLength(message, constant.MaxLenChatMessage);
                        message = parser.preventXSS(message);

                        this.emit('message', message);
                        break;

                    case 'filesend':
                        fileID = dataList[1];
                        fileSize = dataList[2] * 1;
                        fileName = dataList[3];

                        fileName = parser.removeNewline(parser.unescape(fileName));
                        parsed = path.parse(fileName);
                        fileName = parser.limitateLength(parsed.name, constant.MaxLenFileName) + parsed.ext;
                        fileName = parser.preventXSS(fileName);

                        this.emit('filesend', fileID, fileSize, fileName);
                        break;
                    case 'fileaccept':
                        fileID = dataList[1];

                        this.emit('fileaccept', fileID);
                        break;

                    case 'fileokay':
                        fileID = dataList[1];
                        blockIndex = dataList[2] * 1;

                        this.emit('fileokay', fileID, blockIndex);
                        break;

                    case 'fileerror':
                        fileID = dataList[1];
                        blockIndex = dataList[2] * 1;

                        this.emit('fileError', fileID, blockIndex);
                        break;

                    case 'filecancel':
                        fileID = dataList[1];

                        this.emit('fileCancel', fileID);
                        break;

                    default:
                        debug.log("[socket IN] Unknown instruction", dataList);
                        break;
                }
            }
        }
    }

    sendFiledata(fileID, blockIndex, blockHash, blockData) {
        console.log("sendFiledata", fileID, blockIndex, blockHash)
        return protocol.filedata(this.socket, fileID, blockIndex, blockHash, blockData);
    }

    close() {
        if (this.socket && !this.socket.destroyed) { this.socket.destroy(); }
        if (this.socket) {
            debug.log("[socket IN] Closed");
            this.socket = null;
            this.buffer = "";

            this.emit('close');
        }
    }

    destroy() {
        if (this.socket && !this.socket.destroyed) { this.socket.destroy(); }
        this.socket = null;
    }

}
module.exports = SocketIn;