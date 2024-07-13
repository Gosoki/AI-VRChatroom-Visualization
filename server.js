// socket.emit: 向当前连接的客户端发送消息。
// io.emit: 向所有连接的客户端发送消息。
// socket.broadcast.emit: 向除当前连接的客户端外的所有客户端发送消息。
// socket.to(roomId).emit: 向房间内的所有客户端发送消息，但不包括当前连接的客户端。
// io.to(roomId).emit: 向房间内的所有客户端发送消息，包括当前连接的客户端。

// ExpressとSocketIOをインポート
const express = require('express');
const expressapp = express();
const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require("dotenv"); // 環境変数を扱うdotenvモジュールをインポート
// const fetch = require('node-fetch');

dotenv.config(); // 環境変数を.envファイルから読み込む
if (!process.env.OPENAI_APIKEY || !process.env.OPENAI_BASEPATH) {
	throw new Error("required environment variables."); // 必要な環境変数が設定されていない場合はエラーをスロー
}

//web server定数
const PORT = 3000
const usePeerServer = true; // PeerServerを使用するかどうかのフラグ
const peerPORT = PORT + 1; // ポート番号を定義

const options = {
	key: fs.readFileSync("ssl/privkey.pem"), // SSL証明書の秘密鍵を読み込む
	cert: fs.readFileSync("ssl/fullchain.pem"), // SSL証明書を読み込む
};
const server = https.createServer(options, expressapp)

expressapp.use(express.static(
    path.join(__dirname, 'public')
    )
);

//socket.io定数
const io = require('socket.io')(server,{
	allowEIO3: true,
});
// const io = require('socket.io')(server,{
//     allowEIO3: true,    // 兼容v2版本的socket.io客户端
// 	cors: {
// 		origin: ["https://code.wuzuxi.com:5000","wss://code.wuzuxi.com:5000"]
// 	},
// });
// const { Server } = require("socket.io");
// const io = new Server({ /* options */ });
// io.listen(5000);


//Peer server定数

//Peer server定数
if (usePeerServer) {
	const { PeerServer } = require("peer");
	const peerServer = PeerServer({
		port: peerPORT,
		path: "/peerjs",
		key: "peerjs",
		ssl: {
			key : options.key,
			cert: options.cert,
		},
	});
	peerServer.on("connection", (peerClient) => {
		console.log("new peerClient: " + peerClient.id); // 新しいPeerClientが接続したことをログに出力
	});
}

// const { ExpressPeerServer } = require('peer');
// const { v4: uuidv4 } = require('uuid');
// const peerServer = ExpressPeerServer(server, {
// 	debug: true,
// 	// port:5001,
// 	// ssl:{
// 	// 	key : fs.readFileSync('ssl/privkey.pem'),
// 	// 	cert: fs.readFileSync('ssl/fullchain.pem'),
//     // },
// })
// app.use('/peerjs', peerServer)

const folderPath = 'json/'; // 文件夹路径
const filename = `data_${Date.now()}.json`; // 生成文件名
const filePath = folderPath+filename
const speechText = { textdata: [] };

// 创建文件夹（如果不存在）
if (!fs.existsSync(folderPath)) {
	fs.mkdirSync(folderPath);
}

// 写入文件
fs.writeFileSync(filePath, JSON.stringify({ textdata: [] }, null, 2), 'utf8');

//定时器
var timer
//ai话题等待时长
const checkInterval = 20*1000; //1000=1SECOND

const userInfoMap = new Map();
const userPeerInfo = {};

//////Socket.IO FUNCTIONS Start//////
io.on('connection', (socket) => {
	console.log("connection : ", socket.id);
	socket.on('join-room', (roomId, userId, userName) => {
		//console.log("roomId, userId, userName=", roomId, userId, userName);
		userInfoMap.set(socket.id,[roomId,userId,userName]);// 将用户和关联的 roomId 存储在映射中
		userPeerInfo[userId]=userName;
		socket.join(roomId)
		console.log(userInfoMap)
		// for (const [key, value] of userInfoMap) {
		// 	console.log(`User: ${value[2]} in ${value[0]}! socketId:${key},peerId:${value[1]}`);
		//   }
		socket.to(roomId).emit('user-connected', userId, userName)
		io.emit('broadcast_usermap', Object.values(userPeerInfo))

		socket.on('disconnect', () => {
			socket.to(roomId).emit('user-disconnected', [userId,userName])
			userInfoMap.delete(socket.id);// 从映射中删除用户
			console.log("logout:", userName,socket.id,userId)
			console.log(userInfoMap)
			
			//从字典中删除用户
			if (userId in userPeerInfo) {
				delete userPeerInfo[userId];
			}
			io.emit('broadcast_usermap', Object.values(userPeerInfo))
		})

		socket.on('message', (message) => {
			console.log("message =", message);
			io.to(roomId).emit('createMessage', message, userId)
		})

		socket.on("seed_my_info_to_server", (msg) => {
			//console.log(msg)
			let user_id = msg[0];
			let user_color = msg[1];
			let user_name = msg[2];
			let user_position = msg[3];
			let user_msg = msg[4];
			let user_rotation = msg[5];
			socket.to(roomId).emit('broadcast_user_info', [user_id, user_color, user_name, user_position, user_msg,user_rotation]);
		});

		//定义AI连续相关
		let aidraw_count_needs = 500;
		let aidraw_count = 0;
		let aidrawbackground_count_needs = 1;
		let aidrawbackground_count = 0;

        socket.on('seed_my_speech_to_server', async (msg) => {
			const userRoomId = userInfoMap.get(socket.id)[0]; // 获取关联的 roomId
            speechText['textdata'].push({
                userid: msg[0],
                username:msg[1],
                msg: msg[2],
                timestamp: Date.now(),
            });

			console.log(`user[${msg[1]}]:${msg[2]}`)
            clearTimeout(timer);

            timer = setTimeout(function() {
				const last30SpeechText = []
				const lastIndex = Math.max(0, speechText.textdata.length - 30); // 获取最后30条数据的起始索引
				const last30Items = speechText.textdata.slice(lastIndex); // 提取最后30条数据
				last30Items.forEach(item => {
					last30SpeechText.push(item.username + ': ' + item.msg)
				});

				(async () => {
				try {
					const aihint = await sendToGPT(last30SpeechText,"Topics");
					console.log(`server->[${roomId}@all]:${aihint}`);
					io.to(roomId).emit('broadcast_aihint', aihint);
				} catch (error) {
					console.error(error);
				}
				})()
                ;
                console.log('speechText 内容在过去的 %d 秒内未发生变化', checkInterval / 1000);
            }, checkInterval);

            //写入json
            if (fs.existsSync(filePath)) {
                updateFileData(filePath, msg);
            }

			//自动ai图
			if (aidraw_count < aidraw_count_needs){
				aidraw_count++;
			}else{
				(async () => {
					const lastIndex = Math.max(0, speechText.textdata.length - 30); // 获取最后30条数据的起始索引
					const last30Items = speechText.textdata.slice(lastIndex); // 提取最后30条数据
					const last30SpeechText = last30Items.map(item => item.username + ': ' + item.msg);
					try {
						const aihint = await gpt2img(last30SpeechText,"Draw_continue")
						io.to(roomId).emit('broadcast_aidraw_continue', aihint);
						console.log("broadcast_aidraw_continue!")
					} catch (error) {
						console.error(error);
					}
				})()
				aidraw_count = 0;
			}

			//自动ai背景
			if (aidrawbackground_count < aidrawbackground_count_needs){
				aidrawbackground_count++;
			}else{
				(async () => {
					const lastIndex = Math.max(0, speechText.textdata.length - 30); // 获取最后30条数据的起始索引
					const last30Items = speechText.textdata.slice(lastIndex); // 提取最后30条数据
					const last30SpeechText = last30Items.map(item => item.username + ': ' + item.msg);
					try {
						const aihint = await sendToGPT(last30SpeechText,"Draw_background_continue");
						// console.log(`server->[${userRoomId}@user]:${aihint}`);
						socket.emit('broadcast_drawbackground', aihint);
						//io.to(userRoomId).emit('broadcast_aihint', aihint);
					} catch (error) {
						console.error(error);
					}
				})()
				aidrawbackground_count = 0;
			}

		});

		socket.on('seed_hit_needs_to_server', (msg) => {
			//console.log(msg)
			const lastIndex = Math.max(0, speechText.textdata.length - 30); // 获取最后30条数据的起始索引
			const last30Items = speechText.textdata.slice(lastIndex); // 提取最后30条数据
			const last30SpeechText = last30Items.map(item => item.username + ': ' + item.msg);
			console.log(last30SpeechText);
			(async () => {
			try {
				const aihint = await sendToGPT(last30SpeechText,"MainPoints");
				console.log(`server->[${roomId}@user]:${aihint}`);
				socket.emit('broadcast_aihint', aihint);
				//io.to(roomId).emit('broadcast_aihint', aihint);
			} catch (error) {
				console.error(error);
			}
			})()
		});

		
		socket.on('seed_draw_needs_to_server',async (msg) => {
			//console.log(msg)
			const lastIndex = Math.max(0, speechText.textdata.length - 30); // 获取最后30条数据的起始索引
			const last30Items = speechText.textdata.slice(lastIndex); // 提取最后30条数据
			const last30SpeechText = last30Items.map(item => item.username + ': ' + item.msg);
			console.log(speechText)
			console.log(last30SpeechText);
			// (async () => {
			// try {
			// 	const aihint = await gpt2img(last30SpeechText,"Draw")
			// 	socket.emit('broadcast_aidraw', aihint);
			// } catch (error) {
			// 	console.error(error);
			// }
			// })()

			const asyncOperation1 = async () => {
				try {
					const aihint = await gpt2img(last30SpeechText, "Draw");
					socket.emit('broadcast_aidraw_dalle', aihint);
					return "OK";
				} catch (error) {
					console.error("Error in asyncOperation2:", error);
					throw error;
				}
			};
			const asyncOperation2 = async () => {
				try {
					const aihint = await gpt2img_sd(last30SpeechText, "Draw_sd");
					socket.emit('broadcast_aidraw_sd', aihint);
					return "OK";
				} catch (error) {
					console.error("Error in asyncOperation2:", error);
					throw error;
				}
			};
			const [result1, result2] = await Promise.all([
				asyncOperation1(),
				asyncOperation2()
			]);

		});


		socket.on('seed_drawbackground_needs_to_server',async (msg) => {
			//console.log(msg)
			const lastIndex = Math.max(0, speechText.textdata.length - 30); // 获取最后30条数据的起始索引
			const last30Items = speechText.textdata.slice(lastIndex); // 提取最后30条数据
			const last30SpeechText = last30Items.map(item => item.username + ': ' + item.msg);
			console.log(speechText)
			console.log(last30SpeechText);
			(async () => {
				try {
					const aihint = await sendToGPT(last30SpeechText,"Draw_background");
					// console.log(`server->[${userRoomId}@user]:${aihint}`);
					socket.emit('broadcast_drawbackground', aihint);
					//io.to(userRoomId).emit('broadcast_aihint', aihint);
				} catch (error) {
					console.error(error);
				}
				})()

		});

	})
});
//////Socket.IO FUNCTIONS End//////

//////Ai FUNCTIONS Start//////
//发送给gpt sendToGPT();
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_APIKEY,
    basePath: process.env.OPENAI_BASEPATH
});
const openai = new OpenAIApi(configuration);

async function sendToGPT(speechText,mode) {
	switch (mode) {
		case "Topics": //话题
			try {
			const completion = await openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [
					{"role": "system", 
					"content": "私と一緒にロールプレイをしてください。ロールプレイでは、言語モデルではなく、あなたのキャラクター設定で質問に答える必要があります。これが非常に重要です！"},
					{"role": "user", 
					"content": "あなたの設定は、雰囲気を判断することが得意な観察者です。ユーザー間の対話をシミュレートすることはしないでください！あなた自身を表現することもしないでください。あなたは観察者であり、ユーザーに話題を提案するだけで、'私'という言葉を使ったり、自分を観察者と呼んだりしないでください。これが非常に重要です！ユーザー間のチャットメッセージを受け取り、設定に基づいて会話を続けるための一言を返信するだけ、他の言葉はいらないです。これが非常に重要です！返信する際には、ユーザー名を提起しないでください！文脈によって会話を続ける方法がないと判断した場合、新しいトピックを提案します。"},
					{"role": "assistant", 
					"content": "了解しました。ユーザー間のチャットメッセージに基づいてトピックを提案したり、会話を続けるための一言を返信します。会話を進めるために、ユーザーが送信した会話を始めてください。私は会話を続けるための一言を返信します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.data.choices[0].message,completion.data.usage);
				return completion.data.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

		case "MainPoints": //总结
			try {
			const completion = await openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": "ユーザー間の対話をシミュレートすることをしないでください。あなたは観察者です。専門的なまとめ作成者としての役割は、私が提供した対話を簡潔！にまとめることです。返事は簡潔なまとめだけでいいです。"},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、簡潔にまとめられた回答を提供します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.data.choices[0].message,completion.data.usage);
				return completion.data.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

		case "Draw_continue": //dalle画画 连续
			try {
			const completion = await openai.createChatCompletion({
				model: "gpt-4",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,请你判断是否需要绘制一张图片来使得他们间的对话更加便于了解（对话内容中可以被图形表示的部分）,
					针对对话的内容，而无需关注有多少用户参与在聊天，用图片的形式去具象对话中的内容,
					如果需要生成一张图片,请用json的形式(字符串)返回yes or no 和对话中应该被dall-e-3绘画的英语prompt。如下{draw:"yes/no",prompt:"A cute cat"}"}.如果是no,在prompt处输出原因。`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、簡潔にまとめられた回答を提供します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.data.choices[0].message,completion.data.usage);
				return completion.data.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;
		
		case "Draw": //dalle画画
			try {
			const completion = await openai.createChatCompletion({
				model: "gpt-4",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,
					针对对话的内容，而无需关注有多少用户参与在聊天，用图片的形式去具象对话中的内容,
					需要生成一张图片,请用json的形式(字符串)返回draw:"yes"和对话中应该被dall-e-3绘画的英语prompt。如下{draw:"yes",prompt:"A cute cat"}"}。`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、jsonのみを回答します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.data.choices[0].message,completion.data.usage);
				return completion.data.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

			case "Draw_sd": //SD画画
			try {
			const completion = await openai.createChatCompletion({
				model: "gpt-4",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,
					针对对话的内容，而无需关注有多少用户参与在聊天，用图片的形式去具象对话中的内容,
					需要生成一张图片,请用json的形式(字符串)返回draw:"yes"和对话中应该被stable diffusion中绘画的英语prompt。
					提取对话中的关键词,生成对应的prompt,2个人"2 people",3只猫"3 cats",雨天"rain"。
					如下{draw:"yes",prompt:"masterpiece, best quality,sun,2 cat"}"}。`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、jsonのみを回答します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.data.choices[0].message,completion.data.usage);
				return completion.data.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

			case "Draw_background_continue": //画画
			try {
			const completion = await openai.createChatCompletion({
				model: "gpt-4",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,
					针对对话的内容，而无需关注有多少用户参与在聊天，按对话中的内容给我返回颜色代码, 根据话题的积极性与消极性，给与对应的代码颜色代码,如果消极给暖色调，积极给冷色调。不要给深红深蓝,偏温和的色调。
					如果你无法判断颜色，请返回：#d3d3d3 
					请只返回颜色代码，返回值参考如下: #f0f0f0`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、#xxxxxxのみを回答します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.data.choices[0].message,completion.data.usage);
				return completion.data.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

	}
}

// 调用 dalle 生成图像
async function dalleGenerateImage(prompt) {
    const response = await openai.createImage({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,  // 生成图像的数量
		response_format:"b64_json",
        size: "1024x1024",  // 图像的尺寸
    });

    const imageUrl = response.data.data[0].b64_json;
    // console.log("Generated image URL:", imageUrl);
    // const res = await fetch(imageUrl);
    // const fileStream = fs.createWriteStream('generated_image.png');
    // await new Promise((resolve, reject) => {
    //   res.body.pipe(fileStream);
    //   res.body.on("error", reject);
    //   fileStream.on("finish", resolve);
    // });

	return imageUrl
}

// 调用 sd 生成图像
async function sdGenerateImage(prompt) {
	const fetch = (await import('node-fetch')).default;
	console.log("XXXX")
	const url = 'https://f6d90405eeb80aed2f.gradio.live/sdapi/v1/txt2img';  // 替换为您的 Stable Diffusion API 端点
	// const apiKey = 'your_api_key';  // 替换为您的 API 密钥

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			// 'Authorization': `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			prompt: prompt,
			"negative_prompt": "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
			"seed": -1,
			"subseed": -1,
			"sampler_name": "DPM++ 2M",
			"steps": 27,
			"cfg_scale": 8,
			"denoising_strength": 0.35,
			"batch_count": 1,
			"batch_size": 1,
			"width": 512, 
			"height": 512,
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API request failed: ${errorText}`);
	}

	const responseData = await response.json();
	// console.log(responseData.images[0])
	const imageBase64 = responseData.images[0];

	return imageBase64;
}

//调用GPT生成 dalle prompt
async function gpt2img(Text,mode){
    rawString = await sendToGPT(Text,mode)

    const jsonString = rawString
    .replace(/(\w+):/g, '"$1":')
    .replace(/:no/g, ':"no"')
    .replace(/:yes/g, ':"yes"');

    try {
        // 解析为 JSON 对象
        const jsonObject = JSON.parse(jsonString);
        console.log(jsonObject);
		// broadcast_aidraw_reason
		io.emit("broadcast_aidraw_reason",jsonObject)
        if (jsonObject["draw"]=="yes") return await dalleGenerateImage(jsonObject["prompt"])
		
    } catch (error) {
        console.error('Error parsing JSON string:', error);
    }
}

//调用GPT生成 sd prompt
async function gpt2img_sd(Text,mode){
    rawString = await sendToGPT(Text,mode)

    const jsonString = rawString
    .replace(/(\w+):/g, '"$1":')
    .replace(/:no/g, ':"no"')
    .replace(/:yes/g, ':"yes"');

    try {
        // 解析为 JSON 对象
        const jsonObject = JSON.parse(jsonString);
        console.log(jsonObject);
		// broadcast_aidraw_reason
		io.emit("broadcast_aidraw_reason",jsonObject)
        if (jsonObject["draw"]=="yes") return await sdGenerateImage(jsonObject["prompt"])
		
    } catch (error) {
        console.error('Error parsing JSON string:', error);
    }
}
//////Ai FUNCTIONS End//////

//////Write Json ASYNC FUNCTIONS Start//////
async function updateFileData(filename, msg) {
    try {
    const fileData = await fs.promises.readFile(filename, 'utf8');
    // 将JSON内容解析为JavaScript对象
    const jsonData = JSON.parse(fileData);
    // 进行数据操作，例如添加新的用户消息记录
    jsonData.textdata.push({
        userid: msg[0],
        username:msg[1],
        msg: msg[2],
        timestamp: Date.now(),
    });

    const updatedData = JSON.stringify(jsonData, null, 2);
    await fs.promises.writeFile(filename, updatedData, 'utf8');
    console.log('Data updated and saved @'+filename+' successfully.');
    } catch (err) {
    console.error('Error reading or writing file:', err);
    }
}
//////Write Json ASYNC FUNCTIONS End//////


server.listen(PORT, () => console.log(`Listening on port ${PORT}`))







