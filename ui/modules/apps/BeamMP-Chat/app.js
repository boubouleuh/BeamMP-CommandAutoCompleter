// Copyright (C) 2024 BeamMP Ltd., BeamMP team and contributors.
// Licensed under AGPL-3.0 (or later), see <https://www.gnu.org/licenses/>.
// SPDX-License-Identifier: AGPL-3.0-or-later

var app = angular.module('beamng.apps');

let lastSentMessage = "";

let lastMsgId = 0;
let newChatMenu = false;


let isCommandCompleter = false;

app.directive('multiplayerchat', [function () {
	return {
		templateUrl: '/ui/modules/apps/BeamMP-Chat/app.html',
		replace: true,
		restrict: 'EA',
		scope: true,
		controllerAs: 'ctrl'
	}
}]); 


app.controller("Chat", ['$scope', 'Settings', function ($scope, Settings) {
	$scope.init = function() {
		var chatMessages = retrieveChatMessages()
		newChatMenu = Settings.values.enableNewChatMenu;
		//console.log(`[CHAT] New chat menu: ${newChatMenu}`);
		// Set listeners
		var chatinput = document.getElementById("chat-input");
		// To ensure that the element exists
		if (chatinput) {
			chatinput.addEventListener("mouseover", function(){ chatShown = true; showChat(); });
			chatinput.addEventListener("mouseout", function(){ chatShown = false; });
			chatinput.addEventListener('keydown', onKeyDown); //used for 'up arrow' last msg functionality
			chatinput.addEventListener('keyup', onKeyUp); //used for command completion

		}

		var chatlist = document.getElementById("chat-list");
		// To ensure that the element exists
		if (chatlist) {
			chatlist.addEventListener("mouseover", function(){ chatShown = true; showChat(); });
			chatlist.addEventListener("mouseout", function(){ chatShown = false; });
		}
		// Set chat direction
		setChatDirection(localStorage.getItem('chatHorizontal'));
		setChatDirection(localStorage.getItem('chatVertical'));

		const chatbox = document.getElementById("chat-window");
		if (newChatMenu) {
			chatbox.style.display = "none";
		} else {
			chatbox.style.display = "flex";
		}

		if (chatMessages) {
			chatMessages.map((v, i) => {
				addMessage(v.message, v.time)
			})
		}
	};

	$scope.reset = function() {
		$scope.init();
	};

	$scope.select = function() {
		bngApi.engineLua('setCEFFocus(true)');
	};

	function setChatDirection(direction) {
		const chatbox = document.getElementById("chatbox");
		const chatwindow = document.getElementById("chat-window");
		const chatlist = document.getElementById("chat-list");
		if (direction == "left") {
			chatbox.style.flexDirection = "row";
			chatbox.style.marginLeft = "0px";
			chatwindow.style.alignItems = "flex-start";
			localStorage.setItem('chatHorizontal', "left");
		}
		else if (direction == "right") {
			chatbox.style.flexDirection = "row-reverse";
			chatbox.style.marginLeft = "auto";
			chatwindow.style.alignItems = "flex-start";
			localStorage.setItem('chatHorizontal', "right");
		}
		else if (direction == "middle") {
			chatbox.style.flexDirection = "row";
			chatbox.style.marginLeft = "0px";
			chatwindow.style.alignItems = "center";
			localStorage.setItem('chatHorizontal', "middle");
		}
		else if (direction == "top") {
			chatwindow.style.flexDirection = "column-reverse";
			chatlist.style.flexDirection = "column-reverse";
			chatlist.style.marginTop = "0px";
			chatlist.style.marginBottom = "auto";
			localStorage.setItem('chatVertical', "top");
		}
		else if (direction == "bottom") {
			chatwindow.style.flexDirection = "column";
			chatlist.style.flexDirection = "column";
			chatlist.style.marginTop = "auto";
			chatlist.style.marginBottom = "0px";
			localStorage.setItem('chatVertical', "bottom");
		}
	}

	$scope.chatSwapHorizontal = function() {
		const chatHorizontal = localStorage.getItem('chatHorizontal') || "middle";
		if (chatHorizontal == "left") setChatDirection("middle");
		else if (chatHorizontal == "middle") setChatDirection("right");
		else setChatDirection("left");
	}

	$scope.chatSwapVertical = function() {
		const chatVertical = localStorage.getItem('chatVertical');
		if (chatVertical != "top") setChatDirection("top");
		else setChatDirection("bottom");
	}

	$scope.$on('chatMessage', function (event, data) {
		if (data.id > lastMsgId) {
			lastMsgId = data.id;

			var now = new Date();
			var hour    = now.getHours();
			var minute  = now.getMinutes();
			var second  = now.getSeconds();
			if(hour < 10) hour = '0'+hour;
			if(minute < 10) minute = '0'+minute;
			if(second < 10) second = '0'+second;
		
			var time = hour + ":" + minute + ":" + second;
			
			storeChatMessage({message: data.message, time: time})
			addMessage(data.message);
		}
	});

	$scope.$on('clearChatHistory', function (event, data) {
		localStorage.removeItem('chatMessages');
	})

	$scope.$on('SettingsChanged', function (event, data) {
		Settings.values = data.values;
		const chatbox = document.getElementById("chat-window");
		if (newChatMenu) {
			chatbox.style.display = "none";
		} else {
			chatbox.style.display = "flex";
		}
	})

	$scope.chatSend = function() {
		let chatinput = document.getElementById("chat-input");
		const text = chatinput.value
		if (text) {
			lastSentMessage = text;
			if (text.length > 500) addMessage("Your message is over the character limit! (500)");
			else {
				bngApi.engineLua('UI.chatSend(' + bngApi.serializeToLua(text) + ')');
				chatinput.value = '';
			}
		}
	};
}]);



// -------------------------------------------- CHAT FADING -------------------------------------------- //
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
var chatShown = false;
var chatShowTime = 3500; // 5000ms
var chatFadeSteps = 1/30; // 60 steps
var chatFadeSpeed = 1000 / (1/chatFadeSteps); // 1000ms
async function fadeNode(node) {
	// Set the node opacity to 1.0
	node.style.opacity = 1.0;
	// Once the node is shown, we wait before fading it
	// We take care of checking that the chat is not shown while we are waiting before fading
	for (var steps = chatShowTime/35; steps < chatShowTime; steps += chatShowTime/35) {
		if (chatShown) return;
		await sleep(chatShowTime/35);
	}
	// We fade the node
	var nodeOpacity = 1.0;
	while (nodeOpacity > 0.0) {
		// If the user move the mouse hover the chat before
		// this loop as ended then we break the loop
		if (chatShown) return;
		nodeOpacity = nodeOpacity - chatFadeSteps;
		node.style.opacity = nodeOpacity;
		await sleep(chatFadeSpeed);
	}
}

async function showChat() {
	if (newChatMenu) return;			
	if (!isCommandCompleter){  //Chat cant be show when the completer is used
			// While the mouse is over the chat, we wait
			var chatMessages = []
			while (chatShown) {
				if (isCommandCompleter){
					chatShown = false;
				}
				// Get the chat and the messages
				// Copy the variables so it's a pointer
				var tempMessages = document.getElementById("chat-list").getElementsByTagName("li");
				for (i = 0; i < tempMessages.length; i++) {
					chatMessages[i] = tempMessages[i];
				}
				// Set all messages opacity to 1.0
				for (var i = 0; i < chatMessages.length; ++i) chatMessages[i].style.opacity = 1.0;
				await sleep(100);
			}
			// Once the mouse is not over the chat anymore, we wait before fading
			// We take care of checking that the chat is not shown while we are waiting before fading
			let showTime = chatShowTime
			if (isCommandCompleter){
				showTime = 0
			}

			for (var steps = showTime/35; steps < showTime; steps += showTime/35) {
				if (chatShown) return;
				await sleep(showTime/35);
			}
			

			var chatOpacity = 1.0;
			while (chatOpacity > 0.0) {
				// If the user move the mouse hover the chat before
				// this loop as ended then we break the loop
				if (chatShown) break;
				chatOpacity = chatOpacity - chatFadeSteps;
				for (var i = 0; i < chatMessages.length; ++i) chatMessages[i].style.opacity = chatOpacity;
				await sleep(chatFadeSpeed);
			}
	}
}
// -------------------------------------------- CHAT FADING -------------------------------------------- //

// -------------------------------------------- MESSAGE FORMATTING -------------------------------------------- //
function applyCode(string, codes) {
	var elem = document.createElement("span");
	elem.style.fontSize = "initial";
	string = string.replace(/\x00*/g, "");
	for (var i = 0, len = codes.length; i < len; i++) {
		elem.style.cssText += serverStyleMap[codes[i]] + ";";
	}
	elem.innerHTML = string;
	return elem;
}

function formatRichString(string) {
	let tempAreaElement = document.createElement('div');
	tempAreaElement.setAttribute("id", "TEMPAREA");

	var codes = string.match(/\^.{1}/g) || [],
		indexes = [],
		apply = [],
		tmpStr,
		deltaIndex,
		noCode,
		final = document.createDocumentFragment(),
		i;

	for (i = 0, len = codes.length; i < len; i++) {
		indexes.push(string.indexOf(codes[i]));
		string = string.replace(codes[i], "\x00\x00");
	}

	if (indexes[0] !== 0) {
		final.appendChild(applyCode(string.substring(0, indexes[0]), []));
	}

	for (i = 0; i < len; i++) {
		indexDelta = indexes[i + 1] - indexes[i];
		if (indexDelta === 2) {
			while (indexDelta === 2) {
				apply.push(codes[i]);
				i++;
				indexDelta = indexes[i + 1] - indexes[i];
			}
			apply.push(codes[i]);
		} else {
			apply.push(codes[i]);
		}
		if (apply.lastIndexOf("^r") > -1) {
			apply = apply.slice(apply.lastIndexOf("^r") + 1);
		}
		tmpStr = string.substring(indexes[i], indexes[i + 1]);
		final.appendChild(applyCode(tmpStr, apply));
  }
  tempAreaElement.innerHTML = final;
  var innerHTML = [...final.childNodes].map((n) => n.outerHTML).join("\n");

  tempAreaElement = undefined;

  return innerHTML;
}
// -------------------------------------------- MESSAGE FORMATTING -------------------------------------------- //

function storeChatMessage(message) {
  // Check if localStorage is available
  if (typeof(Storage) !== "undefined") {
    // Get the existing chat messages from localStorage (if any)
    let chatMessages = JSON.parse(localStorage.getItem("chatMessages")) || [];

    // Add the new message to the chatMessages array
    chatMessages.push(message);

		if (chatMessages.length > 70) {
			chatMessages.shift()
		}

    // Store the updated chatMessages array back in localStorage
    localStorage.setItem("chatMessages", JSON.stringify(chatMessages));

    // You can optionally return the updated chatMessages array or perform other actions
    return chatMessages;
  } else {
    console.error("localStorage is not available in this browser.");
    return null;
  }
}

function retrieveChatMessages() {
	// Check if localStorage is available
	if (typeof localStorage !== 'undefined') {
		// Get the chat messages from localStorage
		const storedMessages = localStorage.getItem('chatMessages');

		// Parse the stored data if it exists
		if (storedMessages) {
			return JSON.parse(storedMessages);
		}
	}
}

function addMessage(msg, time = null) {
	//getting current time and adding it to the message before displaying
	if (time == null) {
		var now = new Date();
		var hour    = now.getHours();
		var minute  = now.getMinutes();
		var second  = now.getSeconds();
		if(hour < 10) hour = '0'+hour;
		if(minute < 10) minute = '0'+minute;
		if(second < 10) second = '0'+second;

		time = hour + ":" + minute + ":" + second;
	}

  const msgText = "" + msg
	msg = time + " " + msg;

	// Create the message node
	const chatMessageNode = document.createElement("li");
	chatMessageNode.className = "chat-message";

	// create node for the timestamp
	const messageTimestampNode = document.createElement("span");
	messageTimestampNode.className = "chat-message-timestamp";

	const timestampTextNode = document.createTextNode(time);
	messageTimestampNode.appendChild(timestampTextNode);

	chatMessageNode.appendChild(messageTimestampNode)

	// create text for the message itself, add it to chat message list
	const chatList = document.getElementById("chat-list");

	// check if this message is a server message before
	// doing rich formatting
	if (msgText.startsWith("Server: ")) {
		const formattedInnerHtml = formatRichString(msgText);
		chatMessageNode.innerHTML = chatMessageNode.innerHTML + formattedInnerHtml;
	} else {
		const textNode = document.createTextNode(msgText);
		chatMessageNode.appendChild(textNode);
	}

	chatList.appendChild(chatMessageNode);

	// Delete oldest chat message if more than 70 messages exist
	if (chatList.children.length > 70) {
		chatList.removeChild(chatList.children[0]);
	}

	// Scroll the chat depending on its direction
	const chatwindow = document.getElementById("chat-window");
	if (chatwindow.style.flexDirection != "column-reverse") {
		chatList.scrollTop = chatList.scrollHeight
	} else {
		chatList.scrollTop = 0
	};
}

function onKeyDown(e) {
	
	let jsonCommands = getJsonCommands()
	if (e.key == "Tab" && isCommandCompleter){		//Tabulation
		e.preventDefault();	
		let li = document.getElementById("command-list").firstChild;
		console.log(li.dataset.command)
		e.currentTarget.args = jsonCommands[li.dataset.command].parameters;
		e.currentTarget.prefx = getCommandPrefix();
		e.currentTarget.li = li;

		chooseCommand(e)
		
	}

	if (e.key == "ArrowUp") {
		console.log(e);
		document.getElementById("chat-input").value = lastSentMessage;
		e.target.setSelectionRange(lastSentMessage.length, lastSentMessage.length);
	}
	
}

function onKeyUp(e){

	commandCompleter(e);
}


function chooseCommand(e){

	let li = e.currentTarget.li;
	let args = e.currentTarget.args;
	let prefix = e.currentTarget.prefx;

	let chatInput = document.getElementById("chat-input");

	chatInput.value = prefix + li.dataset.command + " ";
	chatInput.focus();

	commandCompleter()
}

function getJsonCommands(){
	return JSON.parse(`
	{
		"ban": {
		"parameters": ["playerName", "duration"],
		"description": "Bans a player from the server"
		},
		"kick": {
		"parameters": ["playerName"],
		"description": "Kicks a player from the server"
		},
		"mute": {
		"parameters": ["playerName", "duration"],
		"description": "Mutes a player in the chat"
		},
		"unban": {
		"parameters": ["playerName"],
		"description": "Unbans a player from the server"
		},
		"give": {
		"parameters": ["playerName", "item", "quantity"],
		"description": "Gives an item to a player"
		},
		"tp": {
		"parameters": ["playerName", "location"],
		"description": "Teleports a player to a specific location"
		}
	}
	`);
}

function getCommandPrefix(){
	return "/"
}


function commandCompleter(e){

		let jsonCommands = getJsonCommands()

		let chatinput = document.getElementById("chat-input");
		let commandCompleter = document.getElementById("command-completer")
		let value = chatinput.value;

		// Get the current value of the input
		const trimmedValue = value.trim();

		// Extract the command from the input
		const inputParts = trimmedValue.split(" ");
		const inputCommand = inputParts[0].substring(1); // Remove the prefix '/'

		let placeholder = document.querySelector(".placeholder")

		let prefix = getCommandPrefix();
		

		if (value.startsWith(prefix)){

			isCommandCompleter = true;
			//make it visible if not
			if (commandCompleter.style.display = "none"){
				commandCompleter.style.display = "unset";
			}

			let commandList = document.getElementById("command-list");

			while (commandList.firstChild) {
				commandList.firstChild.remove();
			}

			// Check if the input value does not already contain a command
			let containsCommand = false;
			for (let command in jsonCommands) {
				if (value.startsWith(prefix + command + " ")) {
				containsCommand = true;
				break;
				}
			}


			if (!containsCommand){
				for (let command in jsonCommands) {

					if (!command.startsWith(inputCommand)){
						continue
					}
					
					placeholder.textContent = ""

					const li = document.createElement("li");			//Todo createli function


					const button = document.createElement("button");


					const nameSpan = document.createElement("span");
					const descriptionSpan = document.createElement("span");

					nameSpan.textContent = command;

					descriptionSpan.textContent = jsonCommands[command].description;			

					li.dataset.command = command;

					button.classList.add("cmd-buttons");

					button.appendChild(nameSpan);
					button.appendChild(descriptionSpan);
					li.appendChild(button);
					commandList.appendChild(li);

					button.addEventListener("click", chooseCommand);
					button.li = li;
					button.args = jsonCommands[command].parameters;
					button.prefx= prefix;

				}
			}
			else{		

				let str = "";
				if (inputParts.length > 1) {
					
					let lastPart = inputParts[inputParts.length - 1];		
					for (let i = 0; i < lastPart.length; i++) { 			//Probably need revision since its not 100% accurate
						str += '  '; 										//That piece of code is used to move the argument placeholder when writing
					} 
				}	
					for (let i = 0; i < inputCommand.length; i++) { 		//To take the command size and add it too, needed to be accurate
						str += '  '; 
					} 
							
					
				

				let remainingParameters = jsonCommands[inputCommand].parameters.slice(inputParts.length - 1);
	
				let newPlaceholder = str + remainingParameters.join(" ");

				placeholder.textContent = newPlaceholder;

																//need to do that with new defined array to choose, for example if the arg is playername then serverside every playername can be sended and we will loop in that
				for (let arg in jsonCommands[inputCommand].parameters) {

	
					// const parameters = jsonCommands[inputCommand].parameters;
					//   const li = document.createElement("li");
					//   const button = document.createElement("button");
			  
					//   button.addEventListener("click", chooseCommand);
					//   button.args = parameters;
					//   button.prefx = prefix;
			  
					//   const nameSpan = document.createElement("span");
			  
					//   nameSpan.textContent = arg;		

					//   li.dataset.command = inputCommand;
			  
					//   button.classList.add("cmd-buttons");
			  
					//   button.appendChild(nameSpan);
					//   li.appendChild(button);
			  
					//   commandList.appendChild(li);
					}
				
			}
			

		}else{
			placeholder.textContent = ""			//reset all
			isCommandCompleter = false;
			chatShown = true;
			showChat()
			commandCompleter.style.display = "none"
		}
	
}