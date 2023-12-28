import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

const supplyApi: string = "https://www.buyholdearn.com/api/circulating-supply";

const PORT = process.env.PORT || 8080;

async function main(): Promise<void> {
  const app: Express = express();

  app.use(bodyParser.json());

  app.listen(PORT, () => {
    console.log(`Express is listening at port ${PORT}`);
  });

  const token = process.env.TELEGRAM_TOKEN as string;

  const bot = new TelegramBot(token, { polling: true });

  let chatId: number | undefined;

  bot.onText(/\/start/, (msg) => {
    chatId = msg.chat.id;
    bot.sendMessage(chatId, "Hello! Your notifications bot has been set up now!");
  });

  app.post("/notify", (req: Request, res: Response) => {
    const webhookEvent = req.body;
    const ethPrice = 2300;
    const logs = webhookEvent.event.data.block.logs;
    // console.log
    if (logs.length === 0) {
      console.log("Empty logs array received, skipping");
    } else {
      const hash = logs[0].transaction.hash;
      let isBuy: boolean;

      // process Transfer data
      const from = "0x" + logs[0].topics[1].slice(26);
      const to = "0x" + logs[0].topics[2].slice(26);
      const tokenAmount = parseInt(logs[0].data, 16) / 1e18;
      if (to === "0x32558f1214bd874c6cbc1ab545b28a18990ff7ee") {
        isBuy = false;
      } else if (from === "0x32558f1214bd874c6cbc1ab545b28a18990ff7ee") {
        isBuy = true;
      }

      // process Swap data
      let tokens: number;
      let eth: number;
      if (isBuy) {
        eth = parseInt(logs[1].data.substr(66, 64), 16) / 1e18;
        tokens = parseInt(logs[1].data.substr(130, 64), 16) / 1e18;
      } else {
        tokens = parseInt(logs[1].data.substr(2, 64), 16) / 1e18;
        eth = parseInt(logs[1].data.substr(194, 64), 16) / 1e18;
      }

      const price = eth / tokens;
      const priceUsd = price * ethPrice;
      const spent = eth * ethPrice;

      // fetch(supplyApi)
      //   .then((res) => res.text())
      //   .then((res) => console.log(res))
      //   .catch((err: any) => console.error("error:" + err));

      const message = `
      swap: ${isBuy ? "buy" : "sell"}
      🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
      Spent: ${spent.toLocaleString("en", { minimumFractionDigits: 2 })} (${eth.toLocaleString(
        "en",
        { minimumFractionDigits: 2 }
      )} WETH)
      Got: ${tokens.toLocaleString("en", { minimumFractionDigits: 2 })} EARN
      Buyer Position: ${hash} 🆕 New! 
      DEX: Uniswap
      Price: $${priceUsd.toLocaleString("en", { minimumFractionDigits: 10 })}
      LP: $
      MarketCap: $`;
      // TX | Buyer | DexTools | Exchange

      if (chatId) {
        bot.sendMessage(chatId, message);
      } else {
        console.log(message);
      }
    }
  });
}

main();
