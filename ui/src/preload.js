// node require
const { remote } = require('electron');
//Security: disable node require after this point
require = null;

// remote require
const EventEmitter = remote.require('events');
const Identicon = remote.require('identicon.js');
const crypto = remote.require('crypto');
const { clipboard } = remote.require('electron');

const netUserList = remote.require('./core/netUserList');
const contact = remote.require('./core/contact');
const config = remote.require('./config');
const constant = remote.require('./constant');
const tor = remote.require('./tor/tor')
const torControl = remote.require('./tor/torControl')
const langs = remote.require('./core/langs')

// ------------------------- ------------- ------------------------- //
// ------------------------- remoteControl ------------------------- //
// ------------------------- ------------- ------------------------- //

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
    newHiddenService: () => { torControl.newHiddenService(); },

    // contact
    isFriend: (address) => { return contact.isFriend(address); },
    addFriend: (address) => {
        contact.addFriend(address)
            .then(() => {
                netUserList.addUserFromFriendList();
                contact.saveContact();
            })
            .catch((err) => { eventEmitter.emit('contactError', err); })
    },
    removeFriend: (address) => {
        contact.removeFriend(address)
            .then(() => {
                contact.saveContact();
            })
            .then((err) => { eventEmitter.emit('contactError', err); })
    },

    getNickname: (address) => {
        return contact.getNickname(address);
    },
    setNickname: (address, nickname) => {
        contact.setNickname(address, nickname);
        contact.saveContact();
    },

    isBlack: (address) => { return contact.isBlack(address); },
    getBlackList: () => { return contact.getBlackList(); },
    addBlack: (address) => {
        contact.addBlack(address)
            .then(() => {
                contact.saveContact();
            })
            .catch((err) => { eventEmitter.emit('contactError', err); })
    },

    removeBlack: (address) => {
        contact.removeBlack(address)
            .then(() => {
                contact.saveContact();
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

    saveConnection: (torrcExpand, bridge) => {
        config.setTorrcExpand(torrcExpand);
        config.setBridge(bridge);
        config.saveSetting();
    },

    switchNightMode: () => {
        config.setNigthMode(!config.getSetting().nigthMode);
        config.saveSetting();
    },

    setLanguage: (lang) => {
        config.setLanguage(lang);
        config.saveSetting();
    },

    MaxLenChatMessage: constant.MaxLenChatMessage,
    MaxLenProfileName: constant.MaxLenProfileName,
    MaxLenProfileInfo: constant.MaxLenProfileInfo,

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
            eventEmitter.emit('chatError', new Error("failed to find user"));
        }
    },

    sendFileDialog: (address) => {
        const targetWindow = BrowserWindow.getFocusedWindow();
        if (targetWindow) {
            dialog.showOpenDialog(targetWindow, { properties: ['openFile'] }, (files) => {
                if (files && files[0] && files[0].length > 0) {
                    const file = files[0];
                    const targetUser = netUserList.findUser(address);
                    if (targetUser) {
                        targetUser.sendFileSend(file)
                            .catch((err) => { eventEmitter.emit('chatError', err); })
                    }
                    else {
                        eventEmitter.emit('chatError', new Error("failed to find user"));
                    }
                }
            });
        }
    },

    sendFile: (address, file) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.sendFileSend(file)
                .catch((err) => { eventEmitter.emit('chatError', err); })
        }
        else {
            eventEmitter.emit('chatError', new Error("failed to find user"));
        }
    },

    acceptFile: (address, fileID) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.sendFileAccept(fileID)
                .catch((err) => { eventEmitter.emit('chatError', err); })
        }
        else {
            eventEmitter.emit('chatError', new Error("failed to find user"));
        }
    },

    cancelFile: (address, fileID) => {
        const targetUser = netUserList.findUser(address);
        if (targetUser) {
            targetUser.fileCancel(fileID)
                .catch((err) => { eventEmitter.emit('chatError', err); })
        }
        else {
            eventEmitter.emit('chatError', new Error("failed to find user"));
        }
    }
}

// ------------------------- -------- ------------------------- //
// ------------------------- userList ------------------------- //
// ------------------------- -------- ------------------------- //

let userList = [];

class User {
    constructor(address) {
        const hash = crypto.createHash('md5').update(address).digest("hex").substr(0, 32);

        this.address = address;
        this.socketOutConnected = false;
        this.socketInConnected = false;
        this.status = 0;
        this.profile = {
            name: "", info: "",
            image: new Identicon(hash, { format: 'svg' }).toString()
        };
        this.client = { name: "", version: "" };

        this.messageList = [];
        this.lastMessageDate = new Date();
    }
}

let eventUserEmitter = new EventEmitter();

function findUser(address) {
    let targetUser;
    userList.forEach(user => {
        if (user.address == address) {
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
            if (message.options.fileID == fileID) {
                targetMessage = message;
            }
        });
        return targetMessage;
    }
}

function removeUser(address) {
    userList = userList.filter((user) => {
        if (user.address == address) {
            return false;
        }
        return true;
    })
}

window.userList = {
    event: eventUserEmitter,
    getList: () => { return userList; },
    findUser: findUser,

    compareUser: (userA, userB) => {
        if (userA.connected && !userB.connected) { return -1; }
        else if (userA.halfConnected && !userB.halfConnected) { return -1; }

        else if (!userA.connected && userB.connected) { return 1; }
        else if (!userA.halfConnected && userB.halfConnected) { return 1; }

        else if ((userA.connected && userB.connected) || (userA.halfConnected && userB.halfConnected)) {

            if (userA.lastMessageDate > userB.lastMessageDate) { return -1; }
            else if (userA.lastMessageDate < userB.lastMessageDate) { return 1; }

            else { return 0; }
        }
        else if ((!userA.connected && !userB.connected) || (!userA.halfConnected && !userB.halfConnected)) {

            if (!contact.isBlack(userA.address) && contact.isBlack(userB.address)) { return -1; }
            else if (contact.isBlack(userA.address) && !contact.isBlack(userB.address)) { return 1; }

            else if (contact.isFriend(userA.address) && !contact.isFriend(userB.address)) { return -1; }
            else if (!contact.isFriend(userA.address) && contact.isFriend(userB.address)) { return 1; }

            else { return 0; }
        }
    },

    addUser: (address) => {
        let targetUser = findUser(address);
        if (!targetUser) {
            targetUser = new User(address)
            userList.push(targetUser);

            eventUserEmitter.emit('updated');
            return targetUser;
        }
    },

    socketOutConnected: (address) => {
        console.log('socketOutconnected');
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketOutConnected == false) {
                targetUser.socketOutConnected = true;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    socketOutDisconnected: (address) => {
        console.log('socketOutDisconnected');
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketOutDisconnected == true) {
                targetUser.socketOutDisconnected = false;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    socketInConnected: (address) => {
        console.log('socketInConnected');
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketInConnected == false) {
                targetUser.socketInConnected = true;
                eventUserEmitter.emit('updated');
            }
            return targetUser;
        }
    },

    socketInDisconnected: (address) => {
        console.log('socketInDisconnected');
        let targetUser = findUser(address);
        if (targetUser) {
            if (targetUser.socketInDisconnected == true) {
                targetUser.socketInDisconnected = false;
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
            if (targetUser.status != status) {
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
            targetUser.lastMessageDate = new Date();

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
tor.event.on('fail', () => { eventEmitter.emit('torFail'); });

// setting
config.event.on('settingUpdate', () => { eventEmitter.emit('settingUpdate'); });

// contact
netUserList.event.on('contactUpdate', () => { eventEmitter.emit('contactUpdate'); })

// user
netUserList.event.on('newUser', (address) => { window.userList.addUser(address); });


netUserList.eventUser.on('socketOutConnected', (address) => { window.userList.socketOutConnected(address); });
netUserList.eventUser.on('socketOutDisconnected', (address) => { window.userList.socketOutDisconnected(address); });
netUserList.eventUser.on('socketInConnected', (address) => { window.userList.socketInConnected(address); });
netUserList.eventUser.on('socketInDisconnected', (address) => { window.userList.socketInDisconnected(address); });

netUserList.eventUser.on('userStatus', (address, status) => { window.userList.status(address, status); });
netUserList.eventUser.on('userProfile', (address, name, info) => { window.userList.profile(address, name, info); });
netUserList.eventUser.on('userClient', (address, name, version) => { window.userList.client(address, name, version); });
netUserList.eventUser.on('userMessage', (address, message, options) => { window.userList.message(address, message, options); });
netUserList.eventUser.on('userDestroy', (address) => { window.userList.destroy(address); });

netUserList.eventUser.on('userFileAccept', (address, fileID) => { window.userList.fileAccept(address, fileID); });
netUserList.eventUser.on('userFileFinished', (address, fileID) => { window.userList.fileFinished(address, fileID); });
netUserList.eventUser.on('userFileError', (address, fileID) => { window.userList.fileError(address, fileID); });
netUserList.eventUser.on('userFileCancel', (address, fileID) => { window.userList.fileCancel(address, fileID); });
netUserList.eventUser.on('userFileData', (address, fileID, accumSize) => { window.userList.fileData(address, fileID, accumSize); });
netUserList.eventUser.on('userFileSpeed', (address, fileID, speed) => { window.userList.fileSpeed(address, fileID, speed); });

/** */