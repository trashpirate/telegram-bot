import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { Network, Alchemy, Utils } from "alchemy-sdk";
import axios from "axios";

dotenv.config();

const ETH_ID = 1027;

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API Key.
  network: Network.ETH_MAINNET, // Replace with your network.
};
const alchemy = new Alchemy(settings);

const supplyApi: string = "https://www.buyholdearn.com/api/circulating-supply";

const PORT = process.env.PORT || 8080;

async function getBasePrice(coinId: number) {
  try {
    const response = await axios.get(
      "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest",
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY, // Replace with your CoinMarketCap API key
          ["Content-Type"]: "application/json",
        },
        params: {
          id: coinId, // Change to the token symbol you want
        },
      }
    );

    // success
    const json = response.data.data[coinId.toString()];
    return json.quote.USD.price;
  } catch (ex) {
    // error
    console.log(ex);
    return undefined;
  }
}

async function getTokens(pairAddress: string) {
  const token0 = await alchemy.core.call({
    to: pairAddress,
    data: "0x0dfe16819b2523f68151ea44c4f107305bfeb85c4b18e7e63ac6f999d8cf9a0e",
  });
  const token1 = await alchemy.core.call({
    to: pairAddress,
    data: "0xd21220a7b5fcd6706feb17ecf897df81a823584a161e849e09b1ff66574ed2cb",
  });

  const token0Address = "0x" + token0.slice(26);
  const token1Address = "0x" + token1.slice(26);
  return [token0Address, token1Address];
}

async function getMarketcap(tokenAddress: string) {
  const supply = await alchemy.core.call({
    to: tokenAddress,
    data: "0x18160ddd7f15c72528c2f94fd8dfe3c8d5aa26e2c50c7d81f4bc7bee8d4b7932", // totalSupply
  });
  const burn = await alchemy.core.getTokenBalances("0x000000000000000000000000000000000000dEaD", [
    tokenAddress,
  ]);

  const totalSupply = parseInt(Utils.hexValue(supply), 16) / 1e18;
  const burned = parseInt(Utils.hexValue(burn.tokenBalances[0].tokenBalance), 16) / 1e18;
  return [totalSupply, burned];
}

async function getLiqudityAmounts(
  pairAddress: string,
  token0Address: string,
  token1Address: string
) {
  const res = await alchemy.core.getTokenBalances(pairAddress, [token0Address, token1Address]);

  const token0Amount = parseInt(Utils.hexValue(res.tokenBalances[0].tokenBalance), 16) / 1e18;
  const token1Amount = parseInt(Utils.hexValue(res.tokenBalances[1].tokenBalance), 16) / 1e18;
  return [token0Amount, token1Amount];
}
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

  // bot.onText(/\/add_token/, (msg) => {
  //   chatId = msg.chat.id;
  //   bot.sendMessage(chatId, "Hello! Your notifications bot has been set up now!");
  // });

  bot.on("callback_query", function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const opts = {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
    };
    let text;

    if (action === "edit") {
      text = "Edited Text";
    }

    bot.editMessageText(text, opts);
  });

  app.post("/notify", async (req: Request, res: Response) => {
    const basePriceUsd = await getBasePrice(ETH_ID);
    const webhookEvent = req.body;
    const logs = webhookEvent.event.data.block.logs;

    const pairAddress = "0x32558f1214bd874c6cbc1ab545b28a18990ff7ee";
    const tokenAddress = "0x0b61c4f33bcdef83359ab97673cb5961c6435f4e";

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
      if (to === pairAddress) {
        isBuy = false;
      } else if (from === pairAddress) {
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
      const priceUsd = price * basePriceUsd;
      const spent = eth * basePriceUsd;

      // fetch marketcap
      const [totalSupply, burned] = await getMarketcap(tokenAddress);
      let marketCap = (totalSupply - burned) * priceUsd;

      // fetch LP
      const [token0Address, token1Address] = await getTokens(pairAddress);

      const [lp0, lp1] = await getLiqudityAmounts(pairAddress, token0Address, token1Address);
      const lp = lp0 * priceUsd + lp1 * basePriceUsd;

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
      LP: $${lp.toLocaleString("en", { minimumFractionDigits: 2 })}
      MarketCap: $${marketCap.toLocaleString("en", { minimumFractionDigits: 2 })}
      `;
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
