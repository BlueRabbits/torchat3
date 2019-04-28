const EventEmitter = require('events');
let eventEmitter = new EventEmitter();
exports.event = eventEmitter;

let setting = {};
exports.setting = setting;

exports.save = () => { ipcRenderer.send('saveSetting', setting); }

exports.set = (newSetting) => {
    setting = newSetting;
    eventEmitter.emit('updateUI');
}