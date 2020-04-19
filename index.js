const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const dotenv = require("dotenv");
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended:true}));
dotenv.config();

const port = process.env.PORT || 80;
const telegramBotUrl = "https://api.telegram.org/bot";
const apiToken = process.env.TG_API_TOKEN;
const coinDataUrl = process.env.COIN_DATA_URL;

let prevBtcUpbitKrw;
let prevBtcBitfinexUsd;
let currentBtcUpbitKrw;
let currentBtcBitfinexUsd;
let intervalPriceAlarm = null;
let alarmFlag = 0;

function fetchData(tickers, base, target, id) {
  return tickers.filter((data) => {
    return (
      data.base === base &&
      data.target === target &&
      data.market.identifier === id
    );
  })[0].last;
}

async function getPrice(chatId) {
  return await axios.get(coinDataUrl);
} 
async function priceAlarm(chatId){
  try {
    const response = await getPrice(chatId);
    currentBtcUpbitKrw = fetchData(
      response.data.tickers,
      "BTC",
      "KRW",
      "upbit"
    );
    currentBtcBitfinexUsd = fetchData(
      response.data.tickers,
      "BTC",
      "USD",
      "bitfinex"
    );
  } catch (err) {
    console.error(err);
  }
  
  axios
    .post(`${telegramBotUrl}${apiToken}/sendMessage`, {
      chat_id: chatId,
      text:
        "Upbit- BTC(KRW):" +
        currentBtcUpbitKrw +
        "\nBitfinex- BTC(USD):" +
        currentBtcBitfinexUsd,
    })
    .catch((err) => {
      console.error(err);
    });
}

function intervalAlarm(chatId){
  if (alarmFlag == 1 && intervalPriceAlarm == null) {
    intervalPriceAlarm = setInterval(priceAlarm, 3000, chatId);
  } else if (alarmFlag == 0 && intervalPriceAlarm != null) {
    clearInterval(intervalPriceAlarm);
    intervalPriceAlarm=null;
  }
}

app.post("/", (req,res) =>{
     const chatId = req.body.message.chat.id;
     const sentMessage = req.body.message.text;
     
     if (sentMessage.match(/price/gi)) {
       priceAlarm(chatId);
     } else if (sentMessage.match(/start/gi)) {
       alarmFlag=1;
     } else if(sentMessage.match(/stop/gi)){
       alarmFlag=0;
     }
    intervalAlarm(chatId);
    res.status(200).send({});
});

app.listen(port, function () {
  console.log("Server is running on port "+ port);
});
