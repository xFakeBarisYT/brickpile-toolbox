const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const clientId = process.env.clientId; // Replace with your bot's client ID
const token = process.env.DISCORD_TOKEN; // Replace with your bot's token

const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verifies BrickPile Model')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID of the BrickPile model to verify')
        .setRequired(true)
    ),
]
  .map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();