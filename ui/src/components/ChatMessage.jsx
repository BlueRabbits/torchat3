import React, { Component } from 'react'
import PropTypes from 'prop-types';

import { remote, ipcRenderer } from 'electron';

import userList from '../userList';

export default class ChatMessage extends Component {
    constructor(props) {
        super(props);

        userList.event.on('updateFile', (address) => {
            if (address == this.props.selectedUser.address) {
                //if file
                this.forceUpdate();
                console.log(this.props.selectedUser.messageList)
            }
        })

        this.state = {
        };
    };

    acceptFile = (fileID) => {
        ipcRenderer.send('acceptFile', {
            address: this.props.selectedUser.address,
            fileID
        })
    }

    cancelFile = (fileID) => {
        ipcRenderer.send('cancelFile', {
            address: this.props.selectedUser.address,
            fileID
        })
    }

    render() {
        const message = this.props.message.message;
        const options = this.props.message.options;
        if (options.fileID) {
            return (
                <div className='message'>
                    {options.fromMe ? 'Me' : 'User'} : {message} <br />
                    file: size:{options.fileSize} accsize:{options.accumSize} acc:{options.accepted ? "true" : "false"}<br />
                    fin:{options.finished ? "true" : "false"} err:{options.error ? "true" : "false"} can:{options.canceled ? "true" : "false"} spd:{options.speed}<br />
                    acceptFile: <span onClick={() => { this.acceptFile(options.fileID) }}>accept</span>
                    cancelFile: <span onClick={() => { this.cancelFile(options.fileID) }}>cancel</span>
                </div>
            )
        }
        else {
            return (
                <div className='message'>
                    {options.fromMe ? 'Me' : 'User'} : {message} <br />
                </div>
            )
        }
    }
}

ChatMessage.propTypes = {
    selectedUser: PropTypes.object,
    message: PropTypes.object,
}

//test
//options.fromMe = false;
//options.fileID = "";
//options.fileSize = 0;
//options.accepted = false;
//options.finished = false;
//options.error = false;
//options.canceled = false;
//options.accumSize = 0;
//options.speed = 0;