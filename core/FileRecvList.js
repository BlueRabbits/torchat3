const EventEmitter = require('events');
const fileHandler = require('./fileHandler');
const debug = require('./debug');

class FileRecvList extends EventEmitter {
    constructor() {
        super();

        this.fileList = [];
    }

    push(fileID, fileSize) {
        this.fileList.push({
            fileID, fileSize,
            accepted: false, finished: false,
            bufferList: {}, recvSize: 0, tempSize: 0, speedSize: 0,
            blockIndex: 0, blockWriting: false
        })
    }

    hasFile(fileID) {
        let fileIndex = -1;
        this.fileList.forEach((aFile, index) => {
            if (aFile.fileID == fileID) { fileIndex = index; }
        });
        if (-1 < fileIndex) { return true; }
        return false;
    }

    acceptFile(fileID) {
        this.fileList.forEach(aFile => {
            if (aFile.fileID == fileID) {
                aFile.accepted = true;
                this.emit('accept', fileID);
            }
        });
    }

    fileCancel(fileID) {
        let changed = false;
        this.fileList = this.fileList.filter((aFile) => {
            if (aFile.fileID == fileID) {
                this.emit('cancel', fileID);
                changed = true;
                return false;
            }
            return true;
        })
        return changed;
    }

    filedata(fileID, blockIndex, blockData) {
        this.fileList.forEach(aFile => {
            if (aFile.fileID == fileID && aFile.accepted) {
                aFile.bufferList[blockIndex] = blockData;
            }
        });
    }
    
    fileSlowFree(fileID) {
        setTimeout(() => {
            this.fileList = this.fileList.filter((file) => {
                if (file.fileID == fileID) { return false; }
                return true;
            })
        }, 1000 * 10)
    }

    fileTransCheck() {
        this.fileList.forEach(filerecv => {
            if (filerecv.accepted && filerecv.blockWriting == false && Object.keys(filerecv.bufferList).length > 0) {
                let bufferSum = "";
                let fileName = './' + filerecv.fileID;
                let createFile = false;
                if (filerecv.blockIndex == 0) { createFile = true; }

                while (filerecv.bufferList[filerecv.blockIndex]) {
                    bufferSum += filerecv.bufferList[filerecv.blockIndex]

                    filerecv.recvSize += filerecv.bufferList[filerecv.blockIndex].length;
                    filerecv.tempSize += filerecv.bufferList[filerecv.blockIndex].length;

                    delete filerecv.bufferList[filerecv.blockIndex];
                    filerecv.blockIndex += 1;
                }

                if (bufferSum.length > 0) {
                    filerecv.blockWriting = true;
                    if (createFile) { fileHandler.writeFileClear(fileName); }
                    fileHandler.writeFileAppend(fileName, bufferSum)
                        .then((recvSize) => {
                            filerecv.blockWriting = false;
                        })
                        .catch((err) => {
                            debug.log(err);
                            filerecv.blockWriting = false;
                            filerecv.accepted = false;
                            this.emit('error', filerecv.fileID);
                        })
                }
            }

            if (filerecv.fileSize <= filerecv.recvSize && filerecv.blockWriting == false) {
                filerecv.accepted = false;
                filerecv.finished = true;
                this.fileSlowFree(filerecv.fileID);
                this.emit('finished', filerecv.fileID);
            }
        })
    }

    fileDataCheck() {
        this.fileList.forEach(filerecv => {
            if ((filerecv.accepted || filerecv.finished) && filerecv.tempSize > 0) {
                this.emit('data', filerecv.fileID, filerecv.recvSize);

                filerecv.speedSize += filerecv.tempSize;
                filerecv.tempSize = 0;
            }
        });
    }

    fileSpeedCheck() {
        this.fileList.forEach(filerecv => {
            if ((filerecv.accepted || filerecv.finished) && filerecv.speedSize > 0) {
                const speed = filerecv.speedSize;
                this.emit('speed', filerecv.fileID, speed);

                filerecv.speedSize = 0;
            }
        });
    }
}
module.exports = FileRecvList