'use strict';

// node require
const { remote } = require('electron');
//Security: disable node require after this point
require = null;

// remote require
const EventEmitter = remote.require('events');
const Identicon = remote.require('identicon.js');
const crypto = remote.require('crypto');
const { clipboard } = remote.require('electron');
const { BrowserWindow, dialog, app } = remote;

const __base = app.getAppPath()

const netUserList = remote.require(`${__base}/core/netUserList`);
const contacts = remote.require(`${__base}/core/contacts`);
const config = remote.require(`${__base}/core/config`);
const constant = remote.require(`${__base}/core/constant`);
const langs = remote.require(`${__base}/core/langs`);
const notification = remote.require(`${__base}/core/notification`);

const tor = remote.require(`${__base}/tor/tor`);
const torControl = remote.require(`${__base}/tor/torControl`);

// ------------------------- ------------- ------------------------- //
// ------------------------- remoteControl ------------------------- //
// ------------------------- ------------- ------------------------- //

//dialog
function getPathOpenDialog() {
    return new Promise((resolve, reject) => {
        const targetWindow = BrowserWindow.getFocusedWindow();
        if (targetWindow) {
            dialog.showOpenDialog(targetWindow, { properties: ['openFile'] }, (files) => {
                if (files && files[0] && files[0].length > 0) {
                    resolve(files[0]);
                    return;
                }
                reject();
            });
            return;
        }
        reject();
    })
}

function getPathSaveDialog(defaultPath) {
    return new Promise((resolve, reject) => {
        const targetWindow = BrowserWindow.getFocusedWindow();
        if (targetWindow) {
            dialog.showSaveDialog(targetWindow, { defaultPath },
                (filePath) => {
                    if (filePath) {
                        resolve(filePath);
                        return;
                    }
                    reject();
                })
            return;
        }
        reject();
    });
}

let eventEmitter = new EventEmitter();
window.remoteControl = {
    event: eventEmitter,

    // electron
    getClipboard: () => { return clipboard.readText() },
    setClipboard: (text) => { clipboard.writeText(text) },

    // tor
    getProgress: () => { return tor.getProgress(); },
    getBootLogs: () => { return tor.getBootLogs(); },
    getSuccess: () => { return tor.getSuccess(); },
    getFail: () => { return tor.getFail(); },
    getHostname: () => { return tor.getHostname(); },

    newHiddenService: () => { torControl.newHiddenService(); },

    // contacts
    isFriend: (address) => { return contacts.isFriend(address); },
    addFriend: (address) => {
        contacts.addFriend(address)
            .then(() => {
                netUserList.addUserFromFriendList();
                contacts.saveContact();
            })
            .catch((err) => { eventEmitter.emit('contactError', err); })
    },
    removeFriend: (address) => {
        contacts.removeFriend(address)
            .then(() => {
                contacts.saveContact();
            })
            .then((err) => { eventEmitter.emit('contactError', err); })
    },

    getUserName: (address) => {
        return netUserList.getUserName(address);
    },
    getNickname: (address) => {
        return contacts.getNickname(address);
    },
    setNickname: (address, nickname) => {
        contacts.setNickname(address, nickname);
        contacts.saveContact();
    },

    isBlack: (address) => { return contacts.isBlack(address); },
    getBlackList: () => { return contacts.getBlackList(); },
    addBlack: (address) => {
        contacts.addBlack(address)
            .then(() => {
                contacts.saveContact();
            })
            .catch((err) => { eventEmitter.emit('contactError', err); })
    },

    removeBlack: (address) => {
        contacts.removeBlack(address)
            .then(() => {
                contacts.saveContact();
            })
            .catch((err) => { eventEmitter.emit('contactError', err); })
    },

    // config
    getSetting: () => {
        return config.getSetting();
    },

    saveProfile: (name, info) => {
        config.setProfileName(name);
        config.setProfileInfo(info);
        config.saveSetting();
    },

    saveConnection: (torrcExpand, useBridge, bridge) => {
        config.setTorrcExpand(torrcExpand);
        config.setUseBridge(useBridge);
        config.setBridge(bridge);
        config.saveSetting();
    },

    setNightMode: (value) => {
        config.setNightMode(value);
        config.saveSetting();
    },

    setLanguage: (lang) => {
        config.setLanguage(lang);
        config.saveSetting();
    },

    setMinimizeToTray: (value) => {
        config.setMinimizeToTray(value);
        config.saveSetting();
    },

    setNotification: (value) => {
        config.setNotification(value);
        config.saveSetting();
    },

    MaxLenChatMessage: constant.MaxLenChatMessage,
    MaxLenProfileName: constant.MaxLenProfileName,
    MaxLenProfileInfo: constant.MaxLenProfileInfo,
    ClientVersion: constant.ClientVersion,

    // Chatting
    sendMessage: (address, message) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.sendMessage(message)
                .catch((err) => {
                    eventEmitter.emit('chatError', err);
                })
        }
        else {
            eventEmitter.emit('chatError', new Error(langs.get('ErrorNoSuchUser')));
        }
    },

    sendFileDialog: (address) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            getPathOpenDialog()
                .then((filePath) => {
                    targetUser.sendFile(filePath)
                        .catch((err) => { eventEmitter.emit('chatError', err); })
                })
                .catch((err) => { })
        }
        else {
            eventEmitter.emit('chatError', new Error(langs.get('ErrorNoSuchUser')));
        }
    },

    sendFile: (address, file) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.sendFile(file)
                .catch((err) => { eventEmitter.emit('chatError', err); })
        }
        else {
            eventEmitter.emit('chatError', new Error(langs.get('ErrorNoSuchUser')));
        }
    },

    acceptFile: (address, fileID) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.acceptFile(fileID)
                .catch((err) => { eventEmitter.emit('chatError', err); })
        }
        else {
            eventEmitter.emit('chatError', new Error(langs.get('ErrorNoSuchUser')));
        }
    },

    cancelFile: (address, fileID) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.cancelFile(fileID)
                .catch((err) => { eventEmitter.emit('chatError', err); })
        }
        else {
            eventEmitter.emit('chatError', new Error(langs.get('ErrorNoSuchUser')));
        }
    },

    saveFile: (address, fileID, fileName) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            getPathSaveDialog(fileName)
                .then((filePath) => {
                    targetUser.saveFile(fileID, filePath)
                        .catch((err) => {
                            eventEmitter.emit('chatError', err);
                        })
                })
                .catch((err) => { })
        }
        else {
            eventEmitter.emit('chatError', new Error(langs.get('ErrorNoSuchUser')));
        }
    },

    // backup
    exportKeyBackup: () => {
        getPathSaveDialog("backupKey")
            .then((filePath) => {
                tor.exportKeyPair(filePath);
            })
            .catch((err) => { })
    },

    importKeyBackup: () => {
        getPathOpenDialog()
            .then((filePath) => {
                tor.importKeyPair(filePath);
            })
            .catch((err) => { })
    },

    exportContactsBackup: () => {
        getPathSaveDialog("backupContact")
            .then((filePath) => {
                contacts.exportContact(filePath)
            })
            .catch((err) => { })
    },

    importContactsBackup: () => {
        getPathOpenDialog()
            .then((filePath) => {
                contacts.importContact(filePath)
            })
            .catch((err) => { })
    },
}

// ------------------------- -------- ------------------------- //
// ------------------------- userList ------------------------- //
// ------------------------- -------- ------------------------- //

let userList = [];

class User {
    constructor(address, profileImage) {
        this.address = address;
        this.socketOutConnected = false;
        this.socketInConnected = false;
        this.status = 0;
        this.profile = {
            name: "", info: "",
            image: profileImage
        };
        this.client = { name: "", version: "" };

        this.messageList = [];
        this.lastMessage = "";
        this.lastActiveTime = new Date();
    }
}

function findUser(address) {
    let targetUser;
    userList.forEach(user => {
        if (user.address === address) {
            targetUser = user;
        }
    });
    return targetUser;
}

function findMessage(address, fileID) {
    const targetUser = findUser(address);
    if (targetUser) {
        let targetMessage;
        targetUser.messageList.forEach(message => {
            if (message.options.fileID === fileID) {
                targetMessage = message;
            }
        });
        return targetMessage;
    }
}

function removeUser(address) {
    userList = userList.filter((user) => {
        if (user.address === address) {
            return false;
        }
        return true;
    })
}

let eventUserEmitter = new EventEmitter();
window.userList = {
    event: eventUserEmitter,
    getList: () => { return userList; },
    findUser: findUser,

    compareUser: (userA, userB) => {
        let connectCountA = 0;
        let connectCountB = 0;

        connectCountA += (userA.socketOutConnected) ? 1 : 0;
        connectCountA += (userA.socketInConnected) ? 1 : 0;
        connectCountB += (userB.socketOutConnected) ? 1 : 0;
        connectCountB += (userB.socketInConnected) ? 1 : 0;

        if (connectCountA > connectCountB) { return -1; }
        else if (connectCountA < connectCountB) { return 1; }

        else if ((connectCountA === 2) && (connectCountA === 2)) {

            if (userA.lastActiveTime > userB.lastActiveTime) { return -1; }
            else if (userA.lastActiveTime < userB.lastActiveTime) { return 1; }

            else { return 0; }
        }
        else if ((connectCountA === 1) && (connectCountA === 1)) {

            if (!contacts.isBlack(userA.address) && contacts.isBlack(userB.address)) { return -1; }
            else if (contacts.isBlack(userA.address) && !contacts.isBlack(userB.address)) { return 1; }

            else if (contacts.isFriend(userA.address) && !contacts.isFriend(userB.address)) { return -1; }
            else if (!contacts.isFriend(userA.address) && contacts.isFriend(userB.address)) { return 1; }

            else { return 0; }
        }
    },

    addUser: (address, profileImage) => {
        let targetUser = findUser(address);
        if (!targetUser) {
            targetUser = new User(address, profileImage)
            userList.push(targetUser);

            eventUserEmitter.emit('updated');
            return targetUser;
        }
    },

    socketOutConnected: (address) => {
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketOutConnected === false) {
                targetUser.socketOutConnected = true;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    socketOutDisconnected: (address) => {
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketOutConnected === true) {
                targetUser.socketOutConnected = false;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    socketInConnected: (address) => {
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketInConnected === false) {
                targetUser.socketInConnected = true;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    socketInDisconnected: (address) => {
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketInConnected === true) {
                targetUser.socketInConnected = false;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },


    destroy: (address) => {
        removeUser(address);
        eventUserEmitter.emit('updated');
    },

    status: (address, status) => {
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.status !== status) {
                targetUser.status = status;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    profile: (address, name, info) => {
        const targetUser = findUser(address);
        if (targetUser) {
            targetUser.profile.name = name;
            targetUser.profile.info = info;

            eventUserEmitter.emit('updated');
            return targetUser;
        }
    },

    client: (address, name, version) => {
        const targetUser = findUser(address);
        if (targetUser) {
            targetUser.client.name = name;
            targetUser.client.info = version;
            return targetUser;
        }
    },

    message: (address, message, options) => {
        const targetUser = findUser(address);
        if (targetUser) {
            if (options.fileID) { // file message
                options.accepted = false;
                options.finished = false;
                options.error = false;
                options.canceled = false;
                options.accumSize = 0;
                options.speed = 0;
            }

            targetUser.messageList.push({ message, options });
            targetUser.lastMessage = message;
            targetUser.lastActiveTime = new Date();

            eventUserEmitter.emit('updated');
            return targetUser;
        }
    },

    fileAccept: (address, fileID) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.accepted = true;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    },

    fileFinished: (address, fileID) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.finished = true;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    },

    fileError: (address, fileID) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.error = true;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    },

    fileCancel: (address, fileID) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.canceled = true;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    },

    fileSaved: (address, fileID) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.saved = true;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    },

    fileData: (address, fileID, accumSize) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.accumSize = accumSize;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    },

    fileSpeed: (address, fileID, speed) => {
        const targetMessage = findMessage(address, fileID)
        if (targetMessage) {
            targetMessage.options.speed = speed;

            eventUserEmitter.emit('updateFile', address);
            return targetMessage;
        }
    }
}

// ------------------------- ----- ------------------------- //
// ------------------------- langs ------------------------- //
// ------------------------- ----- ------------------------- //

window.langs = langs;

// ------------------------- ------------- ------------------------- //
// ------------------------- event listner ------------------------- //
// ------------------------- ------------- ------------------------- //

// tor
tor.event.on('update', () => { eventEmitter.emit('torUpdate'); });
tor.event.on('success', () => { eventEmitter.emit('torSuccess'); });
tor.event.on('fail', (err) => { eventEmitter.emit('torFail', err); });

// setting
config.event.on('settingUpdate', () => { eventEmitter.emit('settingUpdate'); });

// contacts
contacts.event.on('contactUpdate', () => { eventEmitter.emit('contactUpdate'); })

// user
netUserList.event.on('newUser', (address, profileImage) => { window.userList.addUser(address, profileImage); });

netUserList.event.on('userSocketOutConnected', (address) => { window.userList.socketOutConnected(address); });
netUserList.event.on('userSocketOutDisconnected', (address) => { window.userList.socketOutDisconnected(address); });
netUserList.event.on('userSocketInConnected', (address) => { window.userList.socketInConnected(address); });
netUserList.event.on('userSocketInDisconnected', (address) => { window.userList.socketInDisconnected(address); });

netUserList.event.on('userStatus', (address, status) => { window.userList.status(address, status); });
netUserList.event.on('userProfile', (address, name, info) => { window.userList.profile(address, name, info); });
netUserList.event.on('userClient', (address, name, version) => { window.userList.client(address, name, version); });
netUserList.event.on('userMessage', (address, message, options) => { window.userList.message(address, message, options); });
netUserList.event.on('userDestroy', (address) => { window.userList.destroy(address); });

netUserList.event.on('userFileAccept', (address, fileID) => { window.userList.fileAccept(address, fileID); });
netUserList.event.on('userFileFinished', (address, fileID) => { window.userList.fileFinished(address, fileID); });
netUserList.event.on('userFileError', (address, fileID) => { window.userList.fileError(address, fileID); });
netUserList.event.on('userFileCancel', (address, fileID) => { window.userList.fileCancel(address, fileID); });
netUserList.event.on('userFileSaved', (address, fileID) => { window.userList.fileSaved(address, fileID); });
netUserList.event.on('userFileData', (address, fileID, accumSize) => { window.userList.fileData(address, fileID, accumSize); });
netUserList.event.on('userFileSpeed', (address, fileID, speed) => { window.userList.fileSpeed(address, fileID, speed); });

notification.event.on('click', (address) => { eventEmitter.emit('clickUser', address); })

/** */