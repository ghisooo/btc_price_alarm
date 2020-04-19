const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const dotenv = require("dotenv");
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
dotenv.config();

const port = process.env.PORT || 80;
const telegramBotUrl = "https://api.telegram.org/bot";
const apiToken = process.env.TG_API_TOKEN;
const coinDataUrl = process.env.COIN_DATA_URL;

let prevBtcUpbitKrw=0;
let prevBtcBitfinexUsd=0;
let currentBtcUpbitKrw=0;
let currentBtcBitfinexUsd=0;
let intervalPriceAlarm = null;
let intervalAlarmFlag = 0;

app.post("/", (req, res) => {
  const chatId = req.body.message.chat.id;
  const sentMessage = req.body.message.text;

  if (sentMessage.match(/price/gi)) {
    priceAlarm(chatId);
  } else if (sentMessage.match(/start/gi)) {
    intervalAlarmFlag = 1;
  } else if (sentMessage.match(/stop/gi)) {
    intervalAlarmFlag = 0;
  }
  intervalAlarm(chatId);
  res.status(200).send({});
});

function fetchData(tickers, base, target, id) {
  return tickers.filter((data) => {
    return (
      data.base === base &&
      data.target === target &&
      data.market.identifier === id
    );
  })[0].last;
}

async function getPrice() {
  return await axios.get(coinDataUrl);
} 

function pushNotification(obj){
  const priceChange = (prevBtcUpbitKrw === 0) ? 0 : ((currentBtcUpbitKrw - prevBtcUpbitKrw) * 100) / prevBtcUpbitKrw;
  if (
    intervalAlarmFlag === 0 ||
    (intervalAlarmFlag === 1 && priceChange <= -3) ||
    (intervalAlarmFlag === 1 && priceChange >= 5)
  ) {
    // when price drops more than 3% or goes up more than 5%
    obj.upbit = priceChange;
    obj.bitfinex =
      prevBtcUpbitKrw === 0
        ? 0
        : ((currentBtcBitfinexUsd - prevBtcBitfinexUsd) * 100) /
          prevBtcBitfinexUsd;
    return true;
  } else {
    return false;
  }
}
async function priceAlarm(chatId){
  try {
    prevBtcUpbitKrw = currentBtcUpbitKrw;
    prevBtcBitfinexUsd = currentBtcBitfinexUsd;
    const response = await getPrice();
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
  
  let valObj={upbit:0, bitfinex:0};
  if (pushNotification(valObj)) {// if price dropped more than 3%, then push a notification
    axios
      .post(`${telegramBotUrl}${apiToken}/sendMessage`, {
        chat_id: chatId,
        text:
          "Upbit- BTC(KRW):" +
          currentBtcUpbitKrw +
          "(" +
          valObj.upbit +
          "%)" +
          "\nBitfinex- BTC(USD):" +
          currentBtcBitfinexUsd +
          "(" +
          valObj.bitfinex +
          "%)",
      })
      .catch((err) => {
        console.error(err);
      });
  }
}

function intervalAlarm(chatId){
  if (intervalAlarmFlag == 1 && intervalPriceAlarm == null) {
    intervalPriceAlarm = setInterval(priceAlarm, 3600000, chatId); //1hr-interval
  } else if (intervalAlarmFlag == 0 && intervalPriceAlarm != null) {
           clearInterval(intervalPriceAlarm);
           intervalPriceAlarm = null;
         }
}

app.listen(port, function () {
  console.log("Server is running on port "+ port);
});
