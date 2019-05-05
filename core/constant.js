module.exports = {
    // Constants // start with upper case
    ClientName: "TorChat3",
    ClientVersion: "0.1",

    HiddenServiceVersion: 3,

    BufferMaximum: 10000,

    ConnectionTimeOut: 1000 * 60 * 3, // minuites
    KeepAliveTime: 1000 * 30, // seconds
    ConnectionRetryTime: 1000 * 20, // seconds
    ProxyTimeOut: 1000 * 60 * 3, // minutes
    PongWaitingTime: 1000 * 60 * 2, // minutes

    ServiceInsidePort: 12009,

    FileBlockSize: 1024 * 8, // 8k byte
    FileBlockWindow: 16,
    FileBufferSize: 1024 * 1024 * 1, // 1m byte
    FileMaximumSize: 1024 * 1024 * 500, // 500m byte

    ChatListSize: 5000,

    MaxLenChatMessage: 1000,
    MaxLenProfileName: 20,
    MaxLenProfileInfo: 200,
    MaxLenFileName: 200,
}