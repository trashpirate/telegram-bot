"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const app = (0, express_1.default)();
        const port = "8080";
        app.use(body_parser_1.default.json());
        const token = process.env.TELEGRAM_TOKEN;
        const bot = new node_telegram_bot_api_1.default(token, { polling: true });
        let chatId;
        bot.onText(/\/start/, (msg) => {
            chatId = msg.chat.id;
            bot.sendMessage(chatId, "Hello! Your notifications bot has been set up now!");
        });
        app.post("/notify", (req, res) => {
            const webhookEvent = req.body;
            const logs = webhookEvent.event.data.block.logs;
            if (logs.length === 0) {
                console.log("Empty logs array received, sipping");
            }
            else {
                for (let i = 0; i < logs.length; i++) {
                    const topic1 = "0x" + logs[i].topics[1].slice(26);
                    const topic2 = "0x" + logs[i].topics[2].slice(26);
                    const amount = parseInt(logs[i].data, 16) / 1e18;
                    const message = `${topic1} sent ${amount} EARN to ${topic2}`;
                    if (chatId) {
                        bot.sendMessage(chatId, message);
                    }
                    else {
                        console.log(message);
                    }
                }
            }
        });
    });
}
main();
