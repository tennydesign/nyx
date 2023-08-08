//index.js//  01/17/2022
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client(
    {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildIntegrations
        ], partials: [
            Partials.Channel,
            Partials.Reaction,
            Partials.Message,
            Partials.GuildMember
        ]
    }
);

const config = require("./config/config.json");

//Libs imports
const { CommandsLoader } = require("./components/CommandsLoader.js");
const { SQLTablesManager } = require("./components/SQLTablesManager.js");
const { Database } = require("./database/Database.js");

const { SurveyManager } = require("./components/SurveyManager.js");
const { ActivationManager } = require("./components/ActivationManager.js");
const { WalletManager } = require("./components/WalletManager.js");

client.on('ready', async() => {
    console.log(`Logged in as ${client.user.tag}!`);
    new Database(config).checkConnectionState();
    new CommandsLoader(client, [
        SurveyManager,
        ActivationManager,
        WalletManager
    ], config).loadCommands();
    new SQLTablesManager(config, [
        SurveyManager,
    ]).loadTables();
});

client.on(`interactionCreate`, (interaction) => {
    new SurveyManager(interaction, client, config).on();
    new ActivationManager(interaction, client, config).on();
    new WalletManager(interaction, client, config).on();
});


client.login(config.discord.token).then().catch(console.error);