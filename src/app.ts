import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import TelegramBot, { SendMessageOptions, SendPhotoOptions } from "node-telegram-bot-api";
import { Network, Alchemy, Utils } from "alchemy-sdk";
import axios from "axios";
import dotenv from "dotenv";
import { FileOptions } from "buffer";
dotenv.config();

const ETH_ID = 1027;

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API Key.
  network: Network.ETH_MAINNET, // Replace with your network.
};
const alchemy = new Alchemy(settings);

const supplyApi: string = "https://www.buyholdearn.com/api/circulating-supply";

const PORT = process.env.PORT || 8080;

let waitingForERC20Address = {};

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
    bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Add Token", callback_data: "add_token" },
            { text: "Token Settings", callback_data: "token_settings" },
          ],
        ],
      },
    });
  });

  bot.onText(/\/start/, (msg) => {
    chatId = msg.chat.id;
    bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Add Token", callback_data: "add_token" },
            { text: "Token Settings", callback_data: "token_settings" },
          ],
        ],
      },
    });
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

    if (action === "add_token") {
      bot.sendMessage(chatId, "Choose a DEX:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Uniswap V2", callback_data: "uniswap_v2" },
              { text: "PancakeSwap", callback_data: "pcs_v2" },
            ],
          ],
        },
      });
    } else if (action === "uniswap_v2") {
      const chatId = msg.chat.id;
      waitingForERC20Address[chatId] = true;
      bot.sendMessage(chatId, "➡️ Enter Token Address:", {
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]],
        },
      });
    } else if (action === "pcs_v2") {
      text = "Option 2 selected.";
      bot.editMessageText(text, opts);
    }
  });

  bot.on("message", async (message) => {
    const chatId = message.chat.id;

    if (waitingForERC20Address[chatId]) {
      const userAddress = message.text;

      // Check if the address starts with '0x' and is 42 characters long
      if (!userAddress.startsWith("0x") || userAddress.length !== 42) {
        await bot.sendMessage(
          chatId,
          "Invalid ERC20 token address. Please make sure it starts with '0x' and is 42 characters long."
        );
      } else {
        delete waitingForERC20Address[chatId];
        await bot.sendMessage(chatId, `Your ERC20 token address is: ${userAddress}`);
      }
    }
  });

  app.post("/notify", async (req: Request, res: Response) => {
    const basePriceUsd = await getBasePrice(ETH_ID);
    const webhookEvent = req.body;
    const logs = webhookEvent.event.data.block.logs;

    const pairAddress = "0x32558f1214bd874c6cbc1ab545b28a18990ff7ee";
    const tokenAddress = "0x0b61c4f33bcdef83359ab97673cb5961c6435f4e";

    if (logs.length === 0) {
      // console.log("Empty logs array received, skipping");
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
      // console.log("transfer data processed.");

      // process Swap data
      let tokens: number;
      let eth: number;
      if (isBuy) {
        eth = parseInt(logs[1].data.substr(66, 64), 16) / 1e18;
        tokens = parseInt(logs[1].data.substr(130, 64), 16) / 1e18;
        // } else {
        //   tokens = parseInt(logs[1].data.substr(2, 64), 16) / 1e18;
        //   eth = parseInt(logs[1].data.substr(194, 64), 16) / 1e18;
        // }
        // console.log("swap data processed.");

        const price = eth / tokens;
        const priceUsd = price * basePriceUsd;
        const spent = eth * basePriceUsd;

        // fetch marketcap
        const [totalSupply, burned] = await getMarketcap(tokenAddress);
        let marketCap = (totalSupply - burned) * priceUsd;
        // console.log("eth price fetched");

        // fetch LP
        const [token0Address, token1Address] = await getTokens(pairAddress);

        const [lp0, lp1] = await getLiqudityAmounts(pairAddress, token0Address, token1Address);
        const lp = lp0 * priceUsd + lp1 * basePriceUsd;
        // console.log("lp fetched.");

        let photo = `${__dirname}/../public/image.png`;

        const message = `
      *EARN BUY!*\n\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n\n*Spent*: $${spent.toLocaleString("en", {
        minimumFractionDigits: 2,
      })} (${eth.toLocaleString("en", {
          minimumFractionDigits: 2,
        })} WETH)\n*Got*: ${tokens.toLocaleString("en", {
          minimumFractionDigits: 2,
        })} EARN\n[Buyer Posiiton](https://etherscan.io/address/${to}): 🆕 New!\n*DEX*: Uniswap\n*Price*: $${priceUsd.toLocaleString(
          "en",
          { minimumFractionDigits: 10 }
        )} (${price.toLocaleString("en", {
          minimumFractionDigits: 10,
        })} WETH)\n*MarketCap*: $${marketCap.toLocaleString("en", {
          minimumFractionDigits: 2,
        })}\n*LP*: $${lp.toLocaleString("en", {
          minimumFractionDigits: 2,
        })}\n\n[TX](https://etherscan.io/tx/${hash}) | [Chart](https://www.dextools.io/app/en/ether/pair-explorer/${pairAddress}) | [Exchange](https://app.uniswap.org/swap?outputCurrency=${tokenAddress})
      `;
        // Holders Count
        // Token PRice
        // TX | Buyer | DexTools | Exchange

        let opts: SendPhotoOptions = {
          caption: message,
          parse_mode: "Markdown",
        };

        if (chatId) {
          bot.sendPhoto(chatId, photo, opts);
        } else {
          console.log(message);
        }
      }
    }
  });
}

main();
