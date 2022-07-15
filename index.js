/*
 * Starter Project for WhatsApp Echo Bot Tutorial
 *
 * Remix this as the starting point for following the WhatsApp Echo Bot tutorial
 *
 */

"use strict";

// Access token for your app
// (copy token from DevX getting started page
// and save it as environment variable into the .env file)

const config = require("config");
const token = config.get("server.token");
const directLineSecret = config.get("server.directLineSecret");
const phone_number_id = config.get("server.phone_number_id");
const botId = config.get("server.botId");
const verify_token = config.get("server.verify_token");

global.XMLHttpRequest = require("xhr2");
global.WebSocket = require("ws");
// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  axios = require("axios").default,
  app = express().use(body_parser.json()); // creates express http server
const path = require("path");
const router = express.Router();
const { DirectLine } = require("botframework-directlinejs");
axios.defaults.headers.common["Authorization"] = "Bearer";
axios.defaults.headers.post["Content-Type"] = "application/json";

let users  = []; //: {id : string , conversationId: string, greeted : boolean}[]
let activities = [];
var directLine = new DirectLine({
  secret: directLineSecret,
  /*token: 'or put your Direct Line token here (supply secret OR token, not both)' ,*/
  domain: "",
  webSocket: true,
  pollingInterval: 1000,
  timeout: 20000,
  conversationStartProperties: { isStart: true, locale: "en-US" },
});

//for directline

router.get("/", function (req, res) {
  res.sendFile(path.join(__dirname + "/index.html"));
  //__dirname : It will resolve to your project folder.
});

router.get("/privacy", function (req, res) {
  res.sendFile(path.join(__dirname + "/privacy.html"));
});

//add the router
app.use("/", router);

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => {});

// Accepts POST requests at /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the Incoming webhook message
  //console.log(JSON.stringify(req.body, null, 2));

  // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  if (req.body.object) {
    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0] &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      let phone_number_id =
        req.body.entry[0].changes[0].value.metadata.phone_number_id;
      let from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
      let msg_body = req.body.entry[0].changes[0].value.messages[0].text.body; // extract the message text from the webhook payload
      postToBot(phone_number_id, from, msg_body);
    }
    res.sendStatus(200);
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/webhook", (req, res) => {
  /**
   * UPDATE YOUR VERIFY TOKEN
   *This will be the Verify Token value when you set up webhook
   **/
  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === verify_token) {
      // Respond with 200 OK and challenge token from the request
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

function reply(from, activity) {
  let content = activity.attachments
    ? activity.attachments[0].content.body[0]
    : { type: "text", text: { body: activity.text } };
  axios
    .post(
      "https://graph.facebook.com/v13.0/" +
        phone_number_id +
        "/messages?access_token=" +
        token,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: from,
        ...content,
      }
    )
    .then((res) => {})
    .catch((error) => {
      console.error(error);
    });
}

//use directLine
function postToBot(phone_number_id, from, msg_body) {
  //find if user has conversation
  var user = users.find(user => user.id === from)
  if (!user) users.push({id: from})
 directLine
    .postActivity({
      from: { id: from, name: phone_number_id }, // required (from.name is optional)
      type: "message",
      text: msg_body,
    }).subscribe(
      (id) => {
       // let replies =  activities.filter(act => act.id !== id);
        let postActivity = activities.find(act => act.id == id);
        addUser(postActivity, id);
      },
      (error) => { console.log('Error posting :', error  )}
    )
}

  directLine.activity$.subscribe((activity) => {
    if (activity.type !== "message") return;
    if (activity.text == "") return;
    activities.push(activity);
  });

  function addUser(postActivity, id){
    //check if user is already in? 

    //add user
    users.push({id : postActivity.from.id , conversationId : id.split('|')[0]});
    //console.log(users);

    //filter user replies

    let replies = activities.filter(act => act.id.includes(id.split('|')[0]));
    //update activities 
    activities = activities.filter(act => !act.id.includes(id.split('|')[0]))

    //further filter replies
    replies = replies.filter(reply => reply.id !== postActivity.id)
    replyUser(replies, postActivity)
  }

  function replyUser(replies, postActivity){
    //sort messages
    replies.sort((a, b) => {
      if(a.id > b.id) return 1;
      if(a.id < b.id ) return -1
      return 0;
    })
    replies.forEach(element => {
      reply(postActivity.from.id,  element)
    });
  }


