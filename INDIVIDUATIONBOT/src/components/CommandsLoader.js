//CommandsLoader.js// 
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('node:fs');

class CommandsLoader{
    constructor(client, modules, config) {
        this.client = client;
        this.modules = modules
        this.config = config;
    }

    loadCommands() {
        const { REST, Routes } = require('discord.js');

        const commands = [];

        this.modules.forEach((e) => {
            for(const i of new e(null, null, null).loadCommands()) {
                commands.push(i)
            }
        })

        const rest = new REST({ version: '10' }).setToken(this.config.discord.token);

        (async () => {
            try {
                await rest.put(Routes.applicationCommands(this.client.user.id), { body: commands });
                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        })();
    }
}

module.exports = {
    CommandsLoader
}