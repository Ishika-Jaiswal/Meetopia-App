
const APP_ID="f13c87881f584bdd86db055e9ca08074"

let uid = sessionStorage.getItem('uid')

if(!uid){
    uid=String(Math.floor(Math.random()*10000))
    sessionStorage.setItem('uid',uid)
}

let token= null;
let client; //core interface for audio and video streaming

let rtmClient;
let channel;

//room id from url param
//room.html?room=234

//room creation
const queryString= window.location.search
const urlParams =new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    roomId = 'main'
}

let displayName= sessionStorage.getItem('display_name')
if(!displayName){
    window.location = 'lobby.html'
}

let localTracks = []
let remoteUsers = {} //obj bc key value pairs created
let localScreenTracks
let sharingScreen=false

let joinRoomInit = async () =>{

    rtmClient =  await AgoraRTM.createInstance(APP_ID)
    await rtmClient.login({uid,token})

    await rtmClient.addOrUpdateLocalUserAttributes({'name':displayName})

    channel = await rtmClient.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleMemberJoined)
    channel.on('MemberLeft', handleMemberLeft)
    channel.on('ChannelMessage', handleChannelMessage)


    getMembers()
    addBotMessageToDom(`Welcome to the Room ${displayName}! 🖐`)

    client = AgoraRTC.createClient({mode: 'rtc', codec: 'vp8'}) //encoding method
    await client.join(APP_ID, roomId, token, uid)

    client.on('user-published', handleUserPublished)
    client.on('user-left', handleUserLeft)

    joinStream()
}

let joinStream = async () => {
    localTracks= await AgoraRTC.createMicrophoneAndCameraTracks({},{encoderConfig: {
        width: {min: 640, ideal: 920, max:920},
        height: {min:480, ideal: 1080, max:1080}
    }})
    let player= `<div class="video__container" id="user-container-${uid}">
    <div class= "video-player" id="user-${uid}"></div>
    </div>`

    document.getElementById('streams__container').insertAdjacentHTML('beforeend',player)
    document.getElementById(`user-container-${uid}`).addEventListener('click',expandVideoFrame)
    //audio in index 0 and video in index 1
    localTracks[1].play(`user-${uid}`)

    await client.publish(localTracks[0], localTracks[1])
}

let switchToCamera =  async () =>{
    let player= `<div class="video__container" id="user-container-${uid}">
    <div class= "video-player" id="user-${uid}"></div>
    </div>`
    displayFrame.insertAdjacentHTML('beforeend',player)

    await localTracks[0].setMuted(true)
    await localTracks[0].setMuted(true)

    document.getElementById('mic-btn').classList.remove('active')
    document.getElementById('screen-btn').classList.remove('active')

    localTracks[1].play(`user-${uid}`)
    await client.publish(localTracks[1])
}

let handleUserPublished= async (user, mediaType) =>{
    remoteUsers[user.uid]=user
    await client.subscribe(user, mediaType)

    let player= document.getElementById(`user-container-${user.uid}`)

    // console.log('Received video track:', user.videoTrack);


    if(player === null){
        player= `<div class="video__container" id="user-container-${user.uid}">
        <div class= "video-player" id="user-${user.uid}"></div>
        </div>`    
    
        document.getElementById('streams__container').insertAdjacentHTML('beforeend',player)
        document.getElementById(`user-container-${user.uid}`).addEventListener('click',expandVideoFrame)

    }   

    if(displayFrame.style.display){
        let videoFrame = document.getElementById(`user-container-${user.uid}`)
        videoFrame.style.height= '100px'
        videoFrame.style.width= '100px'
    }

    if(mediaType === 'video' && console.log("im in")){
        user.videoTrack.play(`user-${user.uid}`)
    }

    if(mediaType === 'audio'){        
        user.audioTrack.play()
    }
    
}

let handleUserLeft= async (user) =>{
    delete remoteUsers[user.uid]
    document.getElementById(`user-container-${user.uid}`).remove()

    if(userIdInDisplayFrame=== `user-container-${user.uid}`){
        displayFrame.style.display =null;
        let videoFrames= document.getElementsByClassName('video__container')

        for(let i =0; videoFrames.length>i ; i++){
            videoFrames[i].style.height='300px'
            videoFrames[i].style.width='300px'
        }
    }
}

let toggleMic= async (e)=>{
    let button= e.currentTarget

    if(localTracks[1].muted){
        await localTracks[0].setMuted(false)
        button.classList.add('active')
    }else{
        await localTracks[0].setMuted(true)
        button.classList.remove('active')
    }
}

let toggleCamera= async (e)=>{
    let button= e.currentTarget

    if(localTracks[1].muted){
        await localTracks[1].setMuted(false)
        button.classList.add('active')
    }else{
        await localTracks[1].setMuted(true)
        button.classList.remove('active')
    }
}

let toggleScreen= async (e) =>{
    let screenButton= e.currentTarget
    let cameraButton= document.getElementById('camera-btn')

    if(!sharingScreen){
        sharingScreen= true

        screenButton.classList.add('active')
        cameraButton.classList.remove('active')
        cameraButton.style.display= 'none'

        localScreenTracks= await AgoraRTC.createScreenVideoTrack()
        document.getElementById(`user-container-${uid}`).remove()

        displayFrame.style.display = 'block'

        let player= `<div class="video__container" id="user-container-${user.uid}">
        <div class= "video-player" id="user-${uid}"></div>
        </div>`

        displayFrame.insertAdjacentHTML('beforeend', player)
        document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)
        
        userIdInDisplayFrame= `user-container-${uid}`
        localScreenTracks.play(`user-${uid}`)

        await client.unpublish([localTracks[1]])
        await client.publish([localScreenTracks])

        let videoFrames= document.getElementsByClassName('video__container')
        for(let i =0; videoFrames.length > i ; i++){
            if(videoFrames[i].id!=userIdInDisplayFrame){
            videoFrames[i].style.height='100px'
            videoFrames[i].style.width='100px'
            }
          }

    }else{
        sharingScreen=false
        cameraButton.style.display= 'block'
        document.getElementById(`user-container-${uid}`).remove()
        await client.unpublish([localScreenTracks])

        switchToCamera()

    }
}

document.getElementById('camera-btn').addEventListener('click',toggleCamera)
document.getElementById('mic-btn').addEventListener('click',toggleMic)
document.getElementById('screen-btn').addEventListener('click',toggleScreen)
joinRoomInit()

