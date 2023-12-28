import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { AddressInfo } from "net";

dotenv.config();
const PORT = "8080";

async function main(): Promise<void> {
  const app: Express = express();

  app.use(bodyParser.json());

  let server = app.listen(PORT, () => {
    let addressInfo = server.address() as AddressInfo;
    let host = addressInfo.address;
    let port = addressInfo.port;
    console.log(`Express is listening at http://${host}:${port}`);
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
    const logs = webhookEvent.event.data.block.logs;
    if (logs.length === 0) {
      console.log("Empty logs array received, sipping");
    } else {
      for (let i = 0; i < logs.length; i++) {
        const topic1 = "0x" + logs[i].topics[1].slice(26);
        const topic2 = "0x" + logs[i].topics[2].slice(26);
        const amount = parseInt(logs[i].data, 16) / 1e18;

        const message = `${topic1} sent ${amount} EARN to ${topic2}`;

        if (chatId) {
          bot.sendMessage(chatId, message);
        } else {
          console.log(message);
        }
      }
    }
  });
}

main();
