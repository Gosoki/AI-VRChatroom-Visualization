/*
 * @Author: Gosoki Gosoki@github.com
 * @Date: 2023-11-23 19:55:41
 * @LastEditTime: 2024-07-08 15:55:04
 * 
 * Copyright (c) 2024 by Gosoki , All Rights Reserved. 
 */

const socket = io();
const urlObject = new URL(window.location.href);
const peerPort = parseInt(urlObject.port)+1;
//var peer = new Peer() // 创建一个Peer对象
const peer = new Peer(undefined, {
	host: "/",
	port: peerPort,
	path: "/peerjs",
	key: "peerjs",
	debug: 0,
	config: {
		iceServers: [
			// { url:"turn:us-0.turn.peerjs.com:3478",username: "peerjs", credential: "peerjsp" },
			// { url: "turn:en-0.turn.peerjs.com:3478", username: "peerjs", credential: "peerjsp" },
			// { url: "stun:stun.l.google.com:19302" },
            // { url: "stun:stun1.l.google.com:19302" },
            // { url: "stun:stun2.l.google.com:19302" },
			// // { url: "stun:52.197.91.193:10000" },
			// // { url: "turn:52.197.91.193:10000", username: "asd", credential: "123" },
			// // { url: "stun:43.128.228.86:3478" },
			// // { url: "turn:43.128.228.86:3478", username: "asd", credential: "123" },
		],
	},
});

// 创建一个空对象，用于存储peer
const peers = {};
const videoGrid = document.getElementById("videoGrid");
var myVideo

//设定音频参数
const constraints = {
	audio: {
		noiseSuppression: true,
		echoCancellation: true,
		autoGainControl: true
	},
	video: {
		width: { max:32 },
		height: { max:24 },
		frameRate: { max: 10 }
	},
};

//判断用户身份,设定视频参数
if (navigator.userAgent.includes("OculusBrowser")) {
	console.warn("VR Mode");
	constraints.video = false;
	document.querySelector('.mainVideoButton').childNodes[3].textContent = "Oculus";
	// myVideo = document.createElement("video");
	myVideo = document.createElement("p");
	myVideo.textContent = "VRMode"
} else {
	console.warn("PC Mode");
	myVideo = document.createElement("video");
}

myVideo.id = "myVideo"; // 设置自己的视频ID
myVideo.muted = true; // 将自己的视频静音

////socket & peer functions
socket.on("broadcast_user_info", (msg) => {
	let other_user_id = "body-" + msg[0];
	let other_user_color = msg[1];
	let other_user_name = msg[2];
	let other_user_position = msg[3];
	let other_user_msg = msg[4];
	let other_user_rotation = msg[5];

	if (!document.getElementById(other_user_id)) {
		let other_name_plate = document.createElement("a-text");
		other_name_plate.setAttribute("value", other_user_name);
		other_name_plate.setAttribute("align", "center");
		other_name_plate.setAttribute("side", "double");
		other_name_plate.setAttribute("width", "8");
		other_name_plate.setAttribute("position", "0 2.5 0");

		let other_name_msg = document.createElement("a-text");
		other_name_msg.setAttribute("value", other_user_msg);
		other_name_msg.setAttribute("align", "center");
		other_name_msg.setAttribute("side", "double");
		other_name_msg.setAttribute("width", "6");
		other_name_msg.setAttribute("position", "0 2.2 0");

		let other_name_video = document.createElement("a-box");
		other_name_video.setAttribute("position", "0.5 1.9 0");
		other_name_video.setAttribute("rotation", "0 0 0");
		other_name_video.setAttribute("scale", "0.3 0.3 0.3");
		other_name_video.setAttribute("height", "0.8");

		// let other_ball = document.createElement("a-sphere");
		// other_ball.setAttribute("id", other_user_id);
		// other_ball.setAttribute("scale", "1 1 1");
		// other_ball.setAttribute("position", other_user_position.x + " " + other_user_position.y + " " + other_user_position.z);
		// other_ball.appendChild(other_name_plate);
		// other_ball.appendChild(other_name_msg);
		// other_ball.appendChild(other_name_video);
		// document.querySelector("a-scene").appendChild(other_ball);

		let other_ball = document.createElement("a-entity");
		other_ball.setAttribute("id", other_user_id);
		other_ball.setAttribute("gltf-model", "https://cdn.jsdelivr.net/gh/Gosoki/gltf-scene/spider-man_from_spider-man_no_way_home/scene.gltf");
		other_ball.setAttribute("scale", "0.7 0.7 0.7");
		other_ball.setAttribute("position", other_user_position.x + " " + (other_user_position.y-0.8) + " " + other_user_position.z);
		other_ball.appendChild(other_name_plate);
		other_ball.appendChild(other_name_msg);
		other_ball.appendChild(other_name_video);
		document.querySelector("a-scene").appendChild(other_ball);

	} else {
		let other_user = document.getElementById(other_user_id);
		other_user.setAttribute("position", other_user_position.x + " " + (other_user_position.y-1.5) + " " + other_user_position.z);
		other_user.setAttribute("rotation", "0 " + (other_user_rotation.y-180) + " 0");
		other_user.setAttribute("color", other_user_color);
		other_user.setAttribute('animation-mixer', 'clip:Armature|Armature|hero_spiderman01_S08@walk|Base Layer; timeScale: 0.8');
		other_user.childNodes[0].setAttribute("value", other_user_name);
		other_user.childNodes[0].setAttribute("color", other_user_color);
		other_user.childNodes[1].setAttribute("value", other_user_msg);
		other_user.childNodes[1].setAttribute("color", other_user_color);
		other_user.childNodes[2].setAttribute("src", "#");
		other_user.childNodes[2].setAttribute("src", "#" + other_user_id.substring(5)); //去处前头"body-"

		// 取消先前的定时器
		if (other_user.timerId) {
            clearTimeout(other_user.timerId);
        }

		// 设置新的定时器
		other_user.timerId = setTimeout(function() {other_user.removeAttribute('animation-mixer');}, 200);
	}
});

peer.on("open", (peerId) => {
	// peer打开事件，在建立与服务器的连接时发出
	my_peerid = peerId;
	socket.emit("join-room", roomId, peerId, my_name); //发送给服务器自己的peer信息
	console.warn("myInfo=", roomId, peerId, my_name);
	showMessage("roomId:"+roomId)
	showMessage("peerId:"+peerId)
	showMessage("my_name:"+my_name)
});

let myVideoStream; //用于存储自己的视频流,方便通过按钮更改设置
let mediaRecorder;
let audioChunks = [];

navigator.mediaDevices.getUserMedia(constraints)
	// 获取用户媒体设备
	.then((stream) => {
		//检查当前视频设置
		if (stream.getVideoTracks()[0]){
			//默认关闭自己视频
			stream.getVideoTracks()[0].enabled = true;
			// 获取视频轨道的设置
			var videoTrack = stream.getVideoTracks()[0];
			var videoSettings = videoTrack.getSettings();
			// 输出实际的分辨率
			console.warn('Actual video resolution: ' + videoSettings.width + 'x' + videoSettings.height);
			}

		myVideoStream = stream;
		addVideoStream(myVideo, stream);

		peer.on("call", (call) => {
			// 监听peer.call事件
			console.warn("call = ", call);
			call.answer(stream); // 接听来电,返回自己视频
			const video = document.createElement("video"); // 创建一个video元素
			video.id = call.peer; // 设置video元素ID=对方peerId
			call.on("stream", (otherUserVideoStream) => {
				// 监听peer.call stream事件
				addVideoStream(video, otherUserVideoStream); // 将新用户的视频流添加到videoGrid中
				call.on("close", () => {
					video.remove();
					console.log("削除する")
				});
				peers[call.peer] = call;
			});
			
		});

		socket.on("user-connected", (otherUserId, userName) => {
			// 监听用户连接事件,获取对方用户peerID
			// connectToNewUser(otherUserId, stream); //调用peer.call(对方ID,自己视频)连接新用户
			let makeCallTimer;
			let makeCallCounter = 0;
			console.warn("Newuser-connected", otherUserId);
			if ((!peer.connections[otherUserId])) {
				showMessage("userconnect —>" + userName)
				showMessage("try connect —>" + userName)
				const makeCall = () => {
					if (makeCallCounter > 5) { clearInterval(makeCallTimer) };
					makeCallCounter++;
					console.log(makeCallCounter + "*recall:" + otherUserId)
					var call = peer.call(otherUserId, stream);
					const video = document.createElement("video");
					video.id = otherUserId;
					call.on("stream", (otherUserVideoStream) => {
						showMessage("get VideoStream")
						addVideoStream(video, otherUserVideoStream);
						clearInterval(makeCallTimer);
						console.warn("stream", otherUserVideoStream)
						console.warn("stream", otherUserVideoStream.getVideoTracks()[0])
					});
					call.on("close", () => {
						video.remove();
						console.log("削除する")
					});
					peers[otherUserId] = call;
				};
				makeCallTimer = setInterval(makeCall, 6000);
				console.log("User " + userName + " connected!");
				showMessage("User: " + userName + " connected!")
			};
			
			// const call = peer.call(otherUserId, stream);
			// const video = document.createElement("video");
			// video.id = otherUserId;
			// call.on("stream", (otherUserVideoStream) => {
			// 	addVideoStream(video, otherUserVideoStream);
			// });
			// call.on("close", () => {
			// 	video.remove();
			// 	console.log("我要删了")
			// });
			// peers[otherUserId] = call;
			// console.log("User " + userName + " connected!");
			// showMessage("User: " + userName + " connected!")
		});

		const audioStream = new MediaStream(stream.getAudioTracks());
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
            audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            saveButton.disabled = false;
        };

        //mediaRecorder.start();
        })
        .catch(error => {
        console.error("获取音频设备失败:", error);
	},
		(err) => console.log(err)
	).catch(function (err) { console.log(err.name + ": " + err.message); });

socket.on("broadcast_aihint", (aihint) => {
	console.log("AI救我")
	//alert("这是一个弹窗！");
	document.getElementById("aihint").textContent = aihint 
});

let ai_draw_continue = document.createElement("a-box");
ai_draw_continue.setAttribute("id", "aidraw");
ai_draw_continue.setAttribute("position", "3.5 2 -3");
ai_draw_continue.setAttribute("width", "3");
ai_draw_continue.setAttribute("height", "3");
ai_draw_continue.setAttribute("depth", "0.01");
ai_draw_continue.setAttribute("rotation", "0 -45 0");
document.querySelector("a-scene").appendChild(ai_draw_continue);
socket.on("broadcast_aidraw_continue", (aihint) => {
	// console.log("aidrawbase64",aihint)
	ai_draw_continue.setAttribute("src", "data:image/png;base64,"+aihint);
});

let ai_draw_sd = document.createElement("a-box");
ai_draw_sd.setAttribute("id", "aidraw");
ai_draw_sd.setAttribute("position", "-3.5 1 -3");
ai_draw_sd.setAttribute("width", "2");
ai_draw_sd.setAttribute("height", "2");
ai_draw_sd.setAttribute("depth", "0.01");
ai_draw_sd.setAttribute("rotation", "0 45 0");
document.querySelector("a-scene").appendChild(ai_draw_sd);
socket.on("broadcast_aidraw_sd", (aihint) => {
	// console.log("aidrawbase64",aihint)
	ai_draw_sd.setAttribute("src", "data:image/png;base64,"+aihint);
});

let ai_draw_dalle = document.createElement("a-box");
ai_draw_dalle.setAttribute("id", "aidraw");
ai_draw_dalle.setAttribute("position", "-3.5 3 -3");
ai_draw_dalle.setAttribute("width", "2");
ai_draw_dalle.setAttribute("height", "2");
ai_draw_dalle.setAttribute("depth", "0.01");
ai_draw_dalle.setAttribute("rotation", "0 45 0");
document.querySelector("a-scene").appendChild(ai_draw_dalle);
socket.on("broadcast_aidraw_dalle", (aihint) => {
	// console.log("aidrawbase64",aihint)
	ai_draw_dalle.setAttribute("src", "data:image/png;base64,"+aihint);
});


socket.on("broadcast_drawbackground", (aihint) => {
	let background = document.getElementById("background");
	console.log("drawbackground",aihint)
	background.setAttribute("color", aihint);
});


socket.on("broadcast_usermap", (usermap) => {
	console.warn("user in room:"+usermap)
});

socket.on("broadcast_aidraw_reason", (msg) => {
	console.warn(msg)
});

socket.on("user-disconnected", (otherUserInfo) => {
	let otherUserId = otherUserInfo[0];
	let otherUserName = otherUserInfo[1];
	// 监听用户断开连接事件
	let del_body = document.getElementById("body-" + otherUserId);
	if (del_body) document.querySelector("a-scene").removeChild(del_body);

	if (peers[otherUserId]) peers[otherUserId].close();
	if (peers[otherUserId]) delete peers[otherUserId] // 如果peer存在，则关闭peer

	console.log(otherUserName + ":logout!");
	showMessage(otherUserName + ":logout!")
});





////other functions
// const startRecorder = document.getElementById("startRecord");
// const stopRecorder = document.getElementById("stopRecord");
const saveButton = document.getElementById("saveRecord");

// startRecorder.addEventListener("click", () => {
//     startRecorder.disabled = true;
//     stopRecorder.disabled = false;
// 	mediaRecorder.start();
// });


// stopRecorder.addEventListener("click", () => {
// 	startRecorder.disabled = false;
// 	stopRecorder.disabled = true;
// 	if (mediaRecorder.state !== "inactive") {
// 		mediaRecorder.stop();
// 	}
// });

function showMessage(message) {
	// 创建一个新的div元素
	var messageDiv = document.createElement("div");
	// 设置消息内容
	messageDiv.textContent = message;

	// 如果上一条消息存在，则在上一条消息下面显示
	var lastMessageDiv = document.querySelector("#console-messages > div:last-child");
	if (lastMessageDiv) {
		lastMessageDiv.insertAdjacentElement('afterend', messageDiv);
	} else {
		// 否则，在控制台消息容器中显示
		var consoleContainer = document.getElementById("console-messages");
		consoleContainer.appendChild(messageDiv);
	}

	// 设置定时器，在10秒后删除消息
	setTimeout(function() {
		messageDiv.remove();
	}, 8000);
}

saveButton.addEventListener("click", () => {
	const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
	const url = URL.createObjectURL(audioBlob);
	const a = document.createElement("a");
	a.style.display = "none";
	a.href = url;
	a.download = "recorded_audio.wav";
	document.body.appendChild(a);
	a.click();
	window.URL.revokeObjectURL(url);
});


const addVideoStream = (video, stream) => {
	video.srcObject = stream;
	video.addEventListener("loadedmetadata", () => {
		video.play();
	});
	
	videoGrid.append(video);
	const videoline = document.createElement("p");
	videoGrid.append(videoline);
};

const muteUnmute = () => {
	const enabled = myVideoStream.getAudioTracks()[0].enabled;
	if (enabled) {
		myVideoStream.getAudioTracks()[0].enabled = false;
		setUnmuteButton();
	} else {
		setMuteButton();
		myVideoStream.getAudioTracks()[0].enabled = true;
	}
};

const setMuteButton = () => {
	const html = `
		<i class="fas fa-microphone"></i>
		<span>Mute</span>
	`;
	document.querySelector(".mainMuteButton").innerHTML = html;
};

const setUnmuteButton = () => {
	const html = `
		<i class="unmute fas fa-microphone-slash"></i>
		<span>Unmute</span>
	`;
	document.querySelector(".mainMuteButton").innerHTML = html;
};

const playStop = () => {
	let enabled = myVideoStream.getVideoTracks()[0].enabled;
	if (enabled) {
		myVideoStream.getVideoTracks()[0].enabled = false;
		setPlayVideo();
	} else {
		setStopVideo();
		myVideoStream.getVideoTracks()[0].enabled = true;
	}
};

const setStopVideo = () => {
	const html = `
		<i class="fas fa-video"></i>
		<span>Stop Video</span>
	`;
	document.querySelector(".mainVideoButton").innerHTML = html;
};

const setPlayVideo = () => {
	const html = `
		<i class="stop fas fa-video-slash"></i>
		<span>Play Video</span>
	`;
	document.querySelector(".mainVideoButton").innerHTML = html;
};

const scrollToBottom = () => {
	var d = $(".mainChatWindow");
	d.scrollTop(d.prop("scrollHeight"));
};

document.getElementById("nameBtn").addEventListener("click", function () {
	document.getElementById("my_name").textContent = prompt("Your Name", document.getElementById("my_name").innerText);
});
document.getElementById("msgBtn").addEventListener("click", function () {
	document.getElementById("my_msg").textContent = prompt("Your Message", document.getElementById("my_msg").innerText);
});

document.getElementById("hintButton").addEventListener("click", function () {
	socket.emit("seed_hit_needs_to_server", "help");
});

document.getElementById("drawButton").addEventListener("click", function () {
	socket.emit("seed_draw_needs_to_server", "draw");
});

document.getElementById("drawbackgroundButton").addEventListener("click", function () {
	socket.emit("seed_drawbackground_needs_to_server", "Draw_background");
});



////Web Speech API Functions
const transcription = document.getElementById('transcription');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
var recognition = null;

// // 检查浏览器是否支持 Web Speech API
// if (!('webkitSpeechRecognition' in window)) {
// 	alert('你的浏览器不支持 Web Speech API');
// } else {
// 	recognition = new webkitSpeechRecognition();

// 	const checkbox = document.getElementById('languageCheckbox');
// 	checkbox.addEventListener('change', function() {
// 		if (this.checked) {
// 		recognition.lang = 'zh-CN'; // 选中时设置为中文
// 		recognition.stop();
// 		} else {
// 		recognition.lang = 'ja-JP'; // 未选中时设置为日文
// 		recognition.stop();
// 		}
// 	});
// 	//默认语言
// 	recognition.lang = 'ja-JP';

// 	// 开始录音
// 	startButton.addEventListener('click', () => {
// 		recognition.start();
// 		mediaRecorder.start();
// 		startButton.disabled = true;
// 		stopButton.disabled = false;
// 		console.log('Speech recognition started');
// 		});

// 	// 停止录音
// 	stopButton.addEventListener('click', () => {
// 		recognition.stop();
// 		mediaRecorder.stop();
// 		startButton.disabled = false;
// 		stopButton.disabled = true;
// 	});

// 	// 监听录音结果
// 	recognition.addEventListener('result', (event) => {
// 		const transcript = event.results[0][0].transcript;
// 		transcription.textContent = transcript + transcription.textContent;
// 		socket.emit("seed_my_speech_to_server", [my_peerid,my_name,transcript]);
// 		aframeMutlByte(transcript)
// 	});

// 	// 处理错误
// 	recognition.addEventListener('error', (event) => {
// 		console.error(event.error);
// 	});
// 	//循环
// 	recognition.addEventListener('end', () => {
// 		console.log('Speech recognition ended');
// 		if(startButton.disabled){
// 			recognition.start();
// 			console.log('Speech recognition started');
// 		}
// 	});
// }

startButton.addEventListener('click', () => {
	console.log('Speech recognition started')
	mediaRecorder.start();
	startButton.disabled = true;
	stopButton.disabled = false;
	vr_function()
});

// 停止录音
stopButton.addEventListener('click', () => {
	recognition.stop();
	mediaRecorder.stop();
	startButton.disabled = false;
	stopButton.disabled = true;
});

var flag_speech = 0;

function vr_function() {
	// window.SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
	recognition = new webkitSpeechRecognition();	
	let lang = 'ja-JP';
	const checkbox = document.getElementById('languageCheckbox');
	if (checkbox.checked) {
		lang = 'zh-CN'; // 选中时设置为中文
	} else {
		lang = 'ja-JP'; // 未选中时设置为日文
	}

	recognition.lang = lang;

	recognition.interimResults = true;
	recognition.continuous = true;

	recognition.onsoundstart = function() {
		document.getElementById('transcriptionStatus').innerHTML = "認識中";
	};
	recognition.onnomatch = function() {
		document.getElementById('transcriptionStatus').innerHTML = "もう一度試してください";
	};
	recognition.onerror = function() {
		document.getElementById('transcriptionStatus').innerHTML = "エラー";
		if(flag_speech == 0)
			vr_function();
	};
	recognition.onsoundend = function() {
		document.getElementById('transcriptionStatus').innerHTML = "停止中";
			vr_function();
	};

	recognition.onresult = function(event) {
		var results = event.results;
		console.log(results)
		for (var i = event.resultIndex; i < results.length; i++) {
			if (results[i].isFinal)
			{
				let transcript = results[i][0].transcript
				console.log(transcript)
				transcription.textContent = transcript + transcription.textContent;
				// document.getElementById('result_text').innerHTML = results[i][0].transcript;
				vr_function();
				socket.emit("seed_my_speech_to_server", [my_peerid,my_name,transcript]);
				aframeMutlByte(transcript)
			}
			else
			{
				// transcription.textContent = "[途中経過] " + results[i][0].transcript + transcription.textContent;
				// document.getElementById('result_text').innerHTML = "[途中経過] " + results[i][0].transcript;
				flag_speech = 1;
			}
		}
	}
	flag_speech = 0;
	document.getElementById('transcriptionStatus').innerHTML = "Speech to text:";
	recognition.start();
}


////空间传送funcs
document.addEventListener("DOMContentLoaded", function () {
    var teleportTrigger = document.getElementById("teleport-trigger");
    // 添加点击事件监听器，当实体被点击时触发
    teleportTrigger.addEventListener("click", function () {
        // 在点击时跳转到另一个网页
        window.location.href = "/?my_name="+ encodeURIComponent(my_name); // 将链接替换为你想要的目标网页
    });
});

document.addEventListener("DOMContentLoaded", function () {
    // 为每个球体添加点击事件监听器
    for (var i = 1; i <= 18; i++) {
        var sphere = document.getElementById("sphere" + i);
        if (sphere) {
            sphere.addEventListener("click", function (event) {
                var sphereId = event.target.getAttribute("id").replace("sphere", "");
                var targetUrl = "https://code.wuzuxi.com:3000/room" + sphereId + ".html";

                // 在点击时跳转到对应的网页，并传递 my_name 参数
                window.location.href = targetUrl + "?my_name=" + encodeURIComponent(my_name);
            });
        }
    }
});
